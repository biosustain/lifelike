import visNetwork from 'vis-network';
import { uuidv4 } from 'app/shared/utils';
import { isDevMode } from '@angular/core';
import { find } from '../algorithms/d3-sankey/d3-sankey';
import { GraphData } from 'app/interfaces/vis-js.interface';
import { cubehelix } from 'd3';
import { nodeLabelAccessor } from '../utils';

function* generateSLayout(segmentSize, scale = 1) {
  let x = 2 * segmentSize + 1;
  let y = 0;
  let xIncrement = false;

  function* iterateX() {
    while (
      (xIncrement && x < 2 * segmentSize) ||
      (!xIncrement && x > 0)
      ) {
      x += xIncrement ? 1 : -1;
      yield {x: x * scale, y: y * scale};
    }
    xIncrement = !xIncrement;
    yield* iterateY();
  }

  function* iterateY() {
    let i = 0;
    while (i < segmentSize) {
      i++;
      y++;
      yield {x: x * scale, y: y * scale};
    }
    yield* iterateX();
  }

  yield* iterateX();
}

interface LinkedNode {
  fromEdges: Array<any>;
  toEdges: Array<any>;
}

type IntermediateNodeType = visNetwork.Node & SankeyNode & LinkedNode;
export const getTraceDetailsGraph = (trace, {nodes: mainNodes}) => {
  const edges = (trace.detail_edges || trace.edges).map(([from, to, d]) => ({
    from,
    to,
    id: uuidv4(),
    arrows: 'to',
    label: d.type,
    ...(d || {})
  }));
  const nodeIds = [...edges.reduce((nodesSet, {from, to}) => {
    nodesSet.add(from);
    nodesSet.add(to);
    return nodesSet;
  }, new Set())];
  const nodes: Array<IntermediateNodeType> = nodeIds.map((nodeId, idx) => {
    const node = mainNodes.find(({id}) => id === nodeId);
    if (node) {
      const color = cubehelix(node._color);
      color.s = 0;
      const label = nodeLabelAccessor(node);
      if (isDevMode() && !label) {
        console.error(`Node ${node.id} has no label property.`, node);
      }
      return {
        ...node,
        color: '' + color,
        databaseLabel: node.type,
        label
      };
    } else {
      console.error(`Details nodes should never be implicitly define, yet ${nodeId} has not been found.`);
      return {
        id: nodeId,
        label: nodeId,
        databaseLabel: 'Implicitly defined',
        color: 'red'
      };
    }
  });

  nodes.forEach(node => {
    node.fromEdges = [];
    node.toEdges = [];
  });
  const nodeById: Map<number, IntermediateNodeType> = new Map(nodes.map((d, i) => [d.id, d]));
  for (const edge of edges) {
    let {from, to} = edge;
    if (typeof from !== 'object') {
      from = edge.from_obj = find(nodeById, from);
    }
    if (typeof to !== 'object') {
      to = edge.to_obj = find(nodeById, to);
    }
    from.fromEdges.push(edge);
    to.toEdges.push(edge);
  }
  const startNode = find(nodeById, trace.source) as IntermediateNodeType;
  const endNode = find(nodeById, trace.target) as IntermediateNodeType;

  [startNode, endNode].map(node => {
    node.borderWidth = 5;
    node.color = {
      border: 'black',
      background: '' + node.color
    };
  });

  const segmentSize = Math.ceil(nodes.length / 8);

  const sLayout = generateSLayout(segmentSize, 2500 / segmentSize);
  const traverseGraph = node => {
    if (!node._visited) {
      const nextPosition = sLayout.next().value;
      // console.log(nextPosition);
      if (node.fromEdges.length <= 1 && node.toEdges.length <= 1) {
        Object.assign(node, nextPosition);
        // Object.assign(node, nextPosition, {fixed: {x: true, y: true}});
      }
      node._visited = true;
      node.toEdges.forEach(edge => {
        if (edge.from_obj !== endNode && !edge._visited) {
          edge._visited = true;
          traverseGraph(edge.from_obj);
        }
      });
      node.fromEdges.forEach(edge => {
        if (edge.to_obj !== endNode && !edge._visited) {
          edge._visited = true;
          traverseGraph(edge.to_obj);
        }
      });
    }
  };
  traverseGraph(startNode);

  return {
    edges,
    nodes: nodes.map(n => ({
      ...n
    }))
  } as GraphData;
};
