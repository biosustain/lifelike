/* tslint:disable:no-shadowed-variable no-bitwise CommaExpressionJS */

// Based on:
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

import { defaultId } from './d3-sankey';
import findCircuits from 'elementary-circuits-directed-graph';

export function identifyCircles(graph: SankeyData, id = defaultId, sortNodes = null) {
  let circularLinkID = 0;
  if (sortNodes === null) {

    // Building adjacency graph
    const adjList = [];
    graph.links.forEach(link => {
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

    graph.links.forEach(link => {
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
  } else {
    graph.links.forEach(link => {
      if (link.source[sortNodes] < link.target[sortNodes]) {
        link.circular = false;
      } else {
        link.circular = true;
        link.circularLinkID = circularLinkID;
        circularLinkID = circularLinkID + 1;
      }
    });
  }
}
