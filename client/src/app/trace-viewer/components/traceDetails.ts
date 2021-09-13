import { isNullOrUndefined } from 'util';

import { GraphData } from 'app/interfaces/vis-js.interface';
import { annotationTypesMap } from 'app/shared/annotation-styles';

function find(nodeById, id) {
  const node = nodeById.get(id);
  if (!node) {
    throw new Error('missing: ' + id);
  }
  return node;
}

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


export const getTraceDetailsGraph = (trace) => {
  const {
    edges,
    nodes
  } = trace;
  nodes.forEach(node => {
    node._fromEdges = [];
    node._toEdges = [];
  });
  const nodeById = new Map(nodes.map(d => [d.id, d]));
  for (const edge of edges) {
    const {
      from, to
    } = edge;
    if (typeof from !== 'object') {
      edge._fromObj = find(nodeById, from);
      edge._fromObj._fromEdges.push(edge);
    }
    if (typeof to !== 'object') {
      edge._toObj = find(nodeById, to);
      edge._toObj._toEdges.push(edge);
    }
  }
  const startNode = find(nodeById, trace.source);
  const endNode = find(nodeById, trace.target);

  [startNode, endNode].map(node => {
    node.borderWidth = 5;
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
    startNode,
    endNode,
    edges,
    nodes: nodes.map(n => {
      const label = n.databaseLabel || 'unknown';
      const style = annotationTypesMap.get(label.toLowerCase());
      return {
        ...n,
        color: isNullOrUndefined(style) ? '#000' : style.color
      };
    })
  } as GraphData;
};
