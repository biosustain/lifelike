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

import { Injectable } from '@angular/core';

import findCircuits from 'elementary-circuits-directed-graph';
import { max } from 'd3-array';
import { ReplaySubject, Subject, OperatorFunction, Observable } from 'rxjs';
import { map, tap, distinctUntilChanged } from 'rxjs/operators';
import { isEqual } from 'lodash-es';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyNode, SankeyLink, SankeyId, SankeyData, NetworkTraceData } from 'app/sankey/interfaces';
import { debug } from 'app/shared/rxjs/debug';

import { AttributeAccessors } from '../utils/attribute-accessors';
import { left, right } from '../utils/aligin';
import { LayersContext } from '../services/layout.service';
import { ErrorMessages } from '../error';

interface Horizontal {
  width: number;
  x0: number;
  x1: number;
}

interface Vertical {
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

type ProcessedExtent = Horizontal & Vertical;

export interface LayoutData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  sources: SankeyId[];
  targets: SankeyId[];
}

@Injectable()
export class SankeyAbstractLayoutService extends AttributeAccessors {
  constructor(
    readonly truncatePipe: TruncatePipe
  ) {
    super(truncatePipe);
  }

  get sourceValue(): (link: SankeyLink) => number {
    return ({_value, _multiple_values}) => _multiple_values?.[0] ?? _value;
  }

  get targetValue(): (link: SankeyLink) => number {
    return ({_value, _multiple_values}) => _multiple_values?.[1] ?? _value;
  }

  _extent$: Subject<Extent> = new ReplaySubject<Extent>();
  extent$: Observable<ProcessedExtent> = this._extent$.pipe(
    map(({x0, x1, y0, y1}) => ({
      x0, x1, width: x1 - x0,
      y0, y1, height: y1 - y0
    })),
    distinctUntilChanged(isEqual),
    debug<ProcessedExtent>('extent$')
  );
  horizontal$: Observable<Horizontal> = this.extent$.pipe(
    map(({x0, x1, width}) => ({x0, x1, width})),
    distinctUntilChanged(isEqual),
    debug('horizontal$')
  );
  vertical$: Observable<Vertical> = this.extent$.pipe(
    map(({y0, y1, height}) => ({y0, y1, height})),
    distinctUntilChanged(isEqual),
    debug('vertical$')
  );

  dy = 8;
  dx = 10; // nodeWidth
  py = 10; // nodePadding

  nodeSort: <N extends SankeyNode>(a: N, b: N) => number;
  linkSort: <L extends SankeyLink>(a: L, b: L) => number;

  /**
   * Each node maintains list of its source/target links
   * this function resets these lists and repopulates them
   * based on list of links.
   */
  computeNodeLinks = tap(({nodes, links}) => {
    for (const [i, node] of nodes.entries()) {
      node._index = i;
      node._sourceLinks = [];
      node._targetLinks = [];
    }
    this.registerLinks({links, nodes});
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
      const source = (link._source as SankeyNode)._index;
      const target = (link._target as SankeyNode)._index;
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
      const target = (link._target as SankeyNode)._index;
      const source = (link._source as SankeyNode)._index;
      // If self-linking or a back-edge
      if (target === source || (circularLinks[source] && circularLinks[source][target])) {
        link._circular = true;
        link._circularLinkID = circularLinkID;
        circularLinkID = circularLinkID + 1;
      } else {
        link._circular = false;
      }
    });
  });

  /**
   * Calculate the nodes' depth based on the incoming and outgoing links
   * Sets the nodes':
   * - depth:  the depth in the graph
   */
  computeNodeDepths = tap(({nodes}: LayoutData) => {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, '_target', '_sourceLinks')) {
      node._depth = x;
    }
  });

  computeNodeReversedDepths = tap(({nodes}: LayoutData) => {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, '_source', '_targetLinks')) {
      node._reversedDepth = x;
    }
  });

  /**
   * Calculate into which layer node has to be placed and assign x coordinates of this layer
   * - _layer: the depth (0, 1, 2, etc), as is relates to visual position from left to right
   * - _x0, _x1: the x coordinates, as is relates to visual position from left to right
   */
  computeNodeLayers(data) {
    const {dx} = this;
    const align = this.getAlign(data);
    const {nodes} = data as SankeyData;
    const x = max(nodes, d => d._depth) + 1;
    // Don't use Array.fill([]) as it will just copy ref to the same []
    const columns: SankeyNode[][] = new Array(x).fill(undefined).map(() => []);
    for (const node of nodes) {
      const i = Math.max(0, Math.min(x - 1, Math.floor(align.call(null, node, x))));
      node._layer = i;
      columns[i].push(node);
    }
    if (this.nodeSort) {
      for (const column of columns) {
        column.sort(this.nodeSort);
      }
    }
    return {
      x,
      columns
    } as LayersContext;
  }

  static ascendingSourceBreadth(a, b) {
    return SankeyAbstractLayoutService.ascendingBreadth(a._source, b._source) || a._index - b._index;
  }

  static ascendingTargetBreadth(a, b) {
    return SankeyAbstractLayoutService.ascendingBreadth(a._target, b._target) || a._index - b._index;
  }

  static ascendingBreadth(a, b) {
    return a._y0 - b._y0;
  }

  static computeLinkBreadths({nodes}: LayoutData) {
    for (const node of nodes) {
      let y0 = node._y0;
      let y1 = y0;
      for (const link of node._sourceLinks) {
        link._y0 = y0 + link._width / 2;
        // noinspection JSSuspiciousNameCombination
        y0 += link._width;
      }
      for (const link of node._targetLinks) {
        link._y1 = y1 + link._width / 2;
        // noinspection JSSuspiciousNameCombination
        y1 += link._width;
      }
    }
  }

  static find(nodeById, id) {
    const node = nodeById.get(id);
    if (!node) {
      throw Error(ErrorMessages.missingNode(id));
    }
    return node as SankeyNode;
  }

  setExtent(extent: Extent) {
    this._extent$.next(extent);
  }

  /**
   * Given list of links resolve their source/target node id to actual object
   * and register this link to input/output link list in node.
   */
  registerLinks({links, nodes}) {
    const {id} = this;
    const {find} = SankeyAbstractLayoutService;

    const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
    for (const [i, link] of links.entries()) {
      link._index = i;
      const {source, target} = link;
      let {_source, _target} = link;
      if (typeof _source !== 'object') {
        _source = link._source = typeof source !== 'object' ? find(nodeById, source) : source;
      }
      if (typeof _target !== 'object') {
        _target = link._target = typeof target !== 'object' ? find(nodeById, target) : target;
      }
      _source._sourceLinks.push(link);
      _target._targetLinks.push(link);
    }
    if (this.linkSort) {
      const relatedNodes = links.reduce(
        (o, {_source, _target}) => {
          o.add(_source);
          o.add(_target);
          return o;
        },
        new Set()
      );
      for (const {_sourceLinks, _targetLinks} of relatedNodes) {
        _sourceLinks.sort(this.linkSort);
        _targetLinks.sort(this.linkSort);
      }
    }
  }

  /**
   * Iterate over nodes and recursively reiterate on the ones they are connecting to.
   * @param nodes - set of nodes to start iteration with
   * @param nextNodeProperty - property of link pointing to next node (_source, _target)
   * @param nextLinksProperty - property of node pointing to next links (_sourceLinks, _targetLinks)
   */
  getPropagatingNodeIterator = function*(nodes, nextNodeProperty, nextLinksProperty): Generator<[SankeyNode, number]> {
    const n = nodes.length;
    let current = new Set<SankeyNode>(nodes);
    let next = new Set<SankeyNode>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        yield [node, x];
        for (const link of node[nextLinksProperty]) {
          next.add(link[nextNodeProperty] as SankeyNode);
        }
      }
      if (++x > n) {
        throw new Error('circular link');
      }
      current = next;
      next = new Set();
    }
  };

  getAlign({sources, targets}: LayoutData) {
    return sources.length > targets.length ? right : left;
  }

  positionNodesHorizontaly(data, {x1, x0, width}, x) {
    const {dx} = this;
    const kx = (width - dx) / (x - 1);
    for (const node of data.nodes) {
      node._x0 = x0 + node._layer * kx;
      node._x1 = node._x0 + dx;
    }
  }

  repositionNodesHorizontaly(data, {x0}, widthChangeRatio) {
    const {dx} = this;
    if (widthChangeRatio !== 1) {
      for (const node of data.nodes) {
        node._x0 = (node._x0 - x0) * widthChangeRatio + x0;
        node._x1 = node._x0 + dx;
      }
    }
  }
}
