/* tslint:disable:no-shadowed-variable no-bitwise CommaExpressionJS */

// Based on:
// Copyright 2015, Mike Bostock
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the author nor the names of contributors may be used to
//   endorse or promote products derived from this software without specific prior
//   written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
// ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


import { max, min, sum } from 'd3-array';
import { sankeyJustify as justify } from 'd3-sankey';

function find(nodeById, id) {
  const node = nodeById.get(id);
  if (!node) {
    throw new Error('missing: ' + id);
  }
  return node;
}

export function defaultId(d) {
  return d.id;
}

export function computeNodeLinks({nodes, links}: SankeyData, id = defaultId) {
  for (const [i, node] of nodes.entries()) {
    node.index = i;
    node.sourceLinks = [];
    node.targetLinks = [];
  }
  const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
  for (const [i, link] of links.entries()) {
    link.index = i;
    let {source, target} = link;
    if (typeof source !== 'object') {
      source = link.source = find(nodeById, source);
    }
    if (typeof target !== 'object') {
      target = link.target = find(nodeById, target);
    }
    source.sourceLinks.push(link);
    target.targetLinks.push(link);
  }
}

function ascendingSourceBreadth(a, b) {
  return ascendingBreadth(a.source, b.source) || a.index - b.index;
}

function ascendingTargetBreadth(a, b) {
  return ascendingBreadth(a.target, b.target) || a.index - b.index;
}

function ascendingBreadth(a, b) {
  return a.y0 - b.y0;
}

function value(d) {
  return d.value;
}

function computeLinkBreadths({nodes}: SankeyData) {
  for (const node of nodes) {
    let y0 = node.y0;
    let y1 = y0;
    for (const link of node.sourceLinks) {
      link.y0 = y0 + link.width / 2;
      // noinspection JSSuspiciousNameCombination
      y0 += link.width;
    }
    for (const link of node.targetLinks) {
      link.y1 = y1 + link.width / 2;
      // noinspection JSSuspiciousNameCombination
      y1 += link.width;
    }
  }
}

const x0 = 0;
const y0 = 0;
const x1 = 1;
const y1 = 1; // extent
const dx = 24; // nodeWidth
const dy = 8;
let py; // nodePadding
const align = justify;
const iterations = 6;

export function sankey(graph) {
  computeNodeLinks(graph);
  computeNodeValues(graph);
  computeNodeDepths(graph);
  computeNodeHeights(graph);
  computeNodeBreadths(graph);
  computeLinkBreadths(graph);
  return graph;
};

function computeNodeValues({nodes}: SankeyData) {
  for (const node of nodes) {
    node.value = node.fixedValue === undefined
      ? Math.max(sum(node.sourceLinks, value), sum(node.targetLinks, value))
      : node.fixedValue;
  }
}

export function computeNodeDepths({nodes}: SankeyData) {
  const n = nodes.length;
  let current = new Set(nodes);
  let next = new Set<Node>();
  let x = 0;
  while (current.size) {
    for (const node of current) {
      node.depth = x;
      for (const {target} of node.sourceLinks) {
        next.add(target);
      }
    }
    if (++x > n) {
      throw new Error('circular link');
    }
    current = next;
    next = new Set();
  }
}

function computeNodeHeights({nodes}: SankeyData) {
  const n = nodes.length;
  let current = new Set(nodes);
  let next = new Set<Node>();
  let x = 0;
  while (current.size) {
    for (const node of current) {
      // noinspection JSSuspiciousNameCombination
      node.height = x;
      for (const {source} of node.targetLinks) {
        next.add(source);
      }
    }
    if (++x > n) {
      throw new Error('circular link');
    }
    current = next;
    next = new Set();
  }
}

export function computeNodeLayers({nodes}: SankeyData) {
  const x = max(nodes, d => d.depth) + 1;
  const kx = (x1 - x0 - dx) / (x - 1);
  const columns = new Array(x);
  for (const node of nodes) {
    const i = Math.max(0, Math.min(x - 1, Math.floor(align.call(null, node, x))));
    node.layer = i;
    node.x0 = x0 + i * kx;
    node.x1 = node.x0 + dx;
    if (columns[i]) {
      columns[i].push(node);
    } else {
      columns[i] = [node];
    }
  }
  if (sort) {
    for (const column of columns) {
      column.sort(sort);
    }
  }
  return columns;
}

function initializeNodeBreadths(columns) {
  const ky = min(columns, c => (y1 - y0 - (c.length - 1) * py) / sum(c, value));
  for (const nodes of columns) {
    let y = y0;
    for (const node of nodes) {
      node.y0 = y;
      node.y1 = y + node.value * ky;
      y = node.y1 + py;
      for (const link of node.sourceLinks) {
        link.width = link.value * ky;
      }
    }
    y = (y1 - y + py) / (nodes.length + 1);
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      node.y0 += y * (i + 1);
      node.y1 += y * (i + 1);
    }
    reorderLinks(nodes);
  }
}

function computeNodeBreadths(graph) {
  const columns = computeNodeLayers(graph);
  py = Math.min(dy, (y1 - y0) / (max(columns, c => c.length) - 1));
  initializeNodeBreadths(columns);
  for (let i = 0; i < iterations; ++i) {
    const alpha = Math.pow(0.99, i);
    const beta = Math.max(1 - alpha, (i + 1) / iterations);
    relaxRightToLeft(columns, alpha, beta);
    relaxLeftToRight(columns, alpha, beta);
  }
}

// Reposition each node based on its incoming (target) links.
function relaxLeftToRight(columns, alpha, beta) {
  for (let i = 1, n = columns.length; i < n; ++i) {
    const column = columns[i];
    for (const target of column) {
      let y = 0;
      let w = 0;
      for (const {source, value} of target.targetLinks) {
        const v = value * (target.layer - source.layer);
        y += targetTop(source, target) * v;
        w += v;
      }
      if (!(w > 0)) {
        continue;
      }
      const dy = (y / w - target.y0) * alpha;
      target.y0 += dy;
      target.y1 += dy;
      reorderNodeLinks(target);
    }
    if (sort === undefined) {
      column.sort(ascendingBreadth);
    }
    resolveCollisions(column, beta);
  }
}

// Reposition each node based on its outgoing (source) links.
function relaxRightToLeft(columns, alpha, beta) {
  for (let n = columns.length, i = n - 2; i >= 0; --i) {
    const column = columns[i];
    for (const source of column) {
      let y = 0;
      let w = 0;
      for (const {target, value} of source.sourceLinks) {
        const v = value * (target.layer - source.layer);
        y += sourceTop(source, target) * v;
        w += v;
      }
      if (!(w > 0)) {
        continue;
      }
      const dy = (y / w - source.y0) * alpha;
      source.y0 += dy;
      source.y1 += dy;
      reorderNodeLinks(source);
    }
    if (sort === undefined) {
      column.sort(ascendingBreadth);
    }
    resolveCollisions(column, beta);
  }
}

function resolveCollisions(nodes: Array<Node>, alpha) {
  const i = nodes.length >> 1;
  const subject = nodes[i];
  resolveCollisionsBottomToTop(nodes, subject.y0 - py, i - 1, alpha);
  resolveCollisionsTopToBottom(nodes, subject.y1 + py, i + 1, alpha);
  resolveCollisionsBottomToTop(nodes, y1, nodes.length - 1, alpha);
  resolveCollisionsTopToBottom(nodes, y0, 0, alpha);
}

// Push any overlapping nodes down.
function resolveCollisionsTopToBottom(nodes, y, i, alpha) {
  for (; i < nodes.length; ++i) {
    const node = nodes[i];
    const dy = (y - node.y0) * alpha;
    if (dy > 1e-6) {
      node.y0 += dy, node.y1 += dy;
    }
    y = node.y1 + py;
  }
}

// Push any overlapping nodes up.
function resolveCollisionsBottomToTop(nodes, y, i, alpha) {
  for (; i >= 0; --i) {
    const node = nodes[i];
    const dy = (node.y1 - y) * alpha;
    if (dy > 1e-6) {
      node.y0 -= dy, node.y1 -= dy;
    }
    y = node.y0 - py;
  }
}

function reorderNodeLinks({sourceLinks, targetLinks}) {
  for (const {source: {sourceLinks}} of targetLinks) {
    sourceLinks.sort(ascendingTargetBreadth);
  }
  for (const {target: {targetLinks}} of sourceLinks) {
    targetLinks.sort(ascendingSourceBreadth);
  }
}

function reorderLinks(nodes) {
  for (const {sourceLinks, targetLinks} of nodes) {
    sourceLinks.sort(ascendingTargetBreadth);
    targetLinks.sort(ascendingSourceBreadth);
  }
}

// Returns the target.y0 that would produce an ideal link from source to target.
function targetTop(source, target) {
  let y = source.y0 - (source.sourceLinks.length - 1) * py / 2;
  for (const {target: node, width} of source.sourceLinks) {
    if (node === target) {
      break;
    }
    y += width + py;
  }
  for (const {source: node, width} of target.targetLinks) {
    if (node === source) {
      break;
    }
    // noinspection JSSuspiciousNameCombination
    y -= width;
  }
  return y;
}

// Returns the source.y0 that would produce an ideal link from source to target.
function sourceTop(source, target) {
  let y = target.y0 - (target.targetLinks.length - 1) * py / 2;
  for (const {source: node, width} of target.targetLinks) {
    if (node === source) {
      break;
    }
    y += width + py;
  }
  for (const {target: node, width} of source.sourceLinks) {
    if (node === target) {
      break;
    }
    // noinspection JSSuspiciousNameCombination
    y -= width;
  }
  return y;
}
