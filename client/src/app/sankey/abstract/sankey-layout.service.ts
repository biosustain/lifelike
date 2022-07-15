// region Licenses
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

// And on:
// MIT License
//
// Copyright (c) 2017 Tom Shanley
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// endregion

import findCircuits from 'elementary-circuits-directed-graph';
import { ReplaySubject, Subject, Observable } from 'rxjs';
import { map, tap, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { isEqual } from 'lodash-es';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyId, TypeContext } from 'app/sankey/interfaces';
import { debug } from 'app/shared/rxjs/debug';

import { AttributeAccessors } from '../utils/attribute-accessors';
import { ErrorMessages } from '../constants/error';
import { SankeyLink, SankeyNode } from '../model/sankey-document';

export interface Horizontal {
  width: number;
  x0: number;
  x1: number;
}

export interface Vertical {
  height: number;
  y0: number;
  y1: number;
}

export interface Extent {
  x0: number;
  x1: number;

  y0: number;
  y1: number;
}

export type ProcessedExtent = Horizontal & Vertical;

export interface LayoutData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  sources: SankeyId[];
  targets: SankeyId[];
}

export abstract class SankeyAbstractLayoutService<Base extends TypeContext> extends AttributeAccessors<Base> {
  constructor(
    protected readonly truncatePipe: TruncatePipe
  ) {
    super(truncatePipe);
  }

  get sourceValue(): (link: SankeyLink) => number {
    return ({value, multipleValues}) => multipleValues?.[0] ?? value;
  }

  get targetValue(): (link: SankeyLink) => number {
    return ({value, multipleValues}) => multipleValues?.[1] ?? value;
  }


  dy = 8;
  dx = 10; // nodeWidth
  py = 10; // nodePadding

  nodeSort: <N extends Base['node']>(a: N, b: N) => number;
  linkSort: <L extends Base['link']>(a: L, b: L) => number;

  /**
   * Each node maintains list of its source/target links
   * this function resets these lists and repopulates them
   * based on list of links.
   */
  computeNodeLinks = tap(({nodes, links}) => {
    for (const [i, node] of nodes.entries()) {
      node.index = i;
      node.sourceLinks = [];
      node.targetLinks = [];
    }
    this.registerLinks({links});
  });

  /**
   * Find circular links using Johnson's circuit finding algorithm.
   * This function simply preformats data cals `elementary-circuits-directed-graph`
   * library and add results to our graph object.
   */
  identifyCircles = tap(({links, nodes}) => {
    let circularLinkID = 0;

    // Building adjacency graph
    const adjList = [];
    links.forEach(link => {
      const source = (link.source as SankeyNode).index;
      const target = (link.target as SankeyNode).index;
      if (!adjList[source]) {
        adjList[source] = [];
      }
      if (!adjList[target]) {
        adjList[target] = [];
      }

      // Add links if not already in set
      if (adjList[source].indexOf(target) === -1) {
        adjList[source].push(target);
      }
    });

    // Find all elementary circuits
    const cycles = findCircuits(adjList);

    // Sort by circuits length
    cycles.sort((a, b) => a.length - b.length);

    const circularLinks = {};
    for (const cycle of cycles) {
      const last = cycle.slice(-2);
      if (!circularLinks[last[0]]) {
        circularLinks[last[0]] = {};
      }
      circularLinks[last[0]][last[1]] = true;
    }

    links.forEach(link => {
      const target = (link.target as SankeyNode).index;
      const source = (link.source as SankeyNode).index;
      // If self-linking or a back-edge
      if (target === source || (circularLinks[source] && circularLinks[source][target])) {
        link.circular = true;
        link.circularLinkID = circularLinkID;
        circularLinkID = circularLinkID + 1;
      } else {
        link.circular = false;
      }
    });
  });

  /**
   * Calculate the nodes' depth based on the incoming and outgoing links
   * Sets the nodes':
   * - depth:  the depth in the graph
   */
  computeNodeDepths = tap(({nodes}: LayoutData) => {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, 'target', 'sourceLinks')) {
      node.depth = x;
    }
  });

  computeNodeReversedDepths = tap(({nodes}: LayoutData) => {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, 'source', 'targetLinks')) {
      node.reversedDepth = x;
    }
  });

  static ascendingSourceBreadth(a, b) {
    return SankeyAbstractLayoutService.ascendingBreadth(a.source, b.source) || a.index - b.index;
  }

  static ascendingTargetBreadth(a, b) {
    return SankeyAbstractLayoutService.ascendingBreadth(a.target, b.target) || a.index - b.index;
  }

  static ascendingBreadth(a, b) {
    return a.y0 - b.y0;
  }

  static computeLinkBreadths({nodes}: LayoutData) {
    for (const node of nodes) {
      let y0 = node.y0;
      let y1 = y0;
      for (const link of node.sourceLinks) {
        link.y0 = y0 + link.width / 2;
        if (!isFinite(link.y0)) {
          throw new Error('Infinite link.y0');
        }
        // noinspection JSSuspiciousNameCombination
        y0 += link.width;
      }
      for (const link of node.targetLinks) {
        link.y1 = y1 + link.width / 2;
        if (!isFinite(link.y1)) {
          throw new Error('Infinite link.y1');
        }
        // noinspection JSSuspiciousNameCombination
        y1 += link.width;
      }
    }
  }

  /**
   * Given list of links resolve their source/target node id to actual object
   * and register this link to input/output link list in node.
   */
  registerLinks({links}) {
    for (const [i, link] of links.entries()) {
      link.index = i;
      const {source, target} = link;
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    }
    // if (this.linkSort) {
    //   const relatedNodes = links.reduce(
    //     (o, {source, target}) => {
    //       o.add(source);
    //       o.add(target);
    //       return o;
    //     },
    //     new Set()
    //   );
    //   for (const {sourceLinks, targetLinks} of relatedNodes) {
    //     sourceLinks.sort(this.linkSort);
    //     targetLinks.sort(this.linkSort);
    //   }
    // }
  }

  /**
   * Iterate over nodes and recursively reiterate on the ones they are connecting to.
   * @param nodes - set of nodes to start iteration with
   * @param nextNodeProperty - property of link pointing to next node (source, target)
   * @param nextLinksProperty - property of node pointing to next links (sourceLinks, targetLinks)
   */
  getPropagatingNodeIterator = function*(nodes, nextNodeProperty, nextLinksProperty): Generator<[Base['node'], number]> {
    const n = nodes.length;
    let current = new Set<Base['node']>(nodes);
    let next = new Set<Base['node']>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        yield [node, x];
        for (const link of node[nextLinksProperty]) {
          next.add(link[nextNodeProperty] as Base['node']);
        }
      }
      if (++x > n) {
        throw new Error('circular link');
      }
      current = next;
      next = new Set();
    }
  };

  positionNodesHorizontaly(data, {x1, x0, width}: Horizontal, x: number) {
    const {dx} = this;
    const kx = (width - dx) / (x - 1);
    for (const node of data.nodes) {
      node.initialX0 = x0 + node.layer * kx;
      node.initialX1 = node.initialX0 + dx;
    }
  }
}
