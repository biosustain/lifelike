import { uuidv4 } from 'app/shared/utils';
import { nodeLabelAccessor, christianColors, createMapToColor, symmetricDifference } from '../sankey/utils';
import { find, defaultId } from '../sankey/d3-sankey';
import { GraphData } from 'app/interfaces/vis-js.interface';
import { cubehelix } from 'd3';
import visNetwork from 'vis-network';

export const resolveFilteredNodesLinks = nodes => {
  let newLinks = [];
  let oldLinks = [];
  nodes.forEach(node => {
    oldLinks = oldLinks.concat(node.sourceLinks, node.targetLinks);
    const nodeNewLinks = node.sourceLinks.reduce((inewLinks, sl, sIter) => {
      const targetNode = sl.target;
      const targetIndex = targetNode.targetLinks.findIndex(l => l === sl);
      targetNode.targetLinks.splice(targetIndex, 1);
      return node.targetLinks.reduce((iinewLinks, tl, tIter) => {
        // used for link initial position after creation
        const templateLink = sIter % 2 ? sl : tl;
        const sourceNode = tl.source;
        const newLink = {
          ...templateLink,
          folded: true,
          id: uuidv4(),
          source: sourceNode,
          target: targetNode,
          value: ((sl.value + tl.value) / 2) || 1,
          path: `${tl.path} => ${nodeLabelAccessor(node)} => ${sl.path}`
        };
        iinewLinks.push(newLink);
        if (!tIter) {
          const sourceIndex = sourceNode.sourceLinks.findIndex(l => l === tl);
          sourceNode.sourceLinks.splice(sourceIndex, 1);
        }
        sourceNode.sourceLinks.push(newLink);
        targetNode.targetLinks.push(newLink);
        return iinewLinks;
      }, inewLinks);
    }, []);
    newLinks = newLinks.concat(nodeNewLinks);
    // corner case - starting or ending node
    if (!nodeNewLinks.length) {
      // console.log(newLinks, oldLinks);
    }
  });
  return {
    newLinks,
    oldLinks
  };
};

export const getAndColorNetworkTraceLinks = (networkTrace, links, colorMap = undefined) => {
  const traceBasedLinkSplitMap = new Map();
  const traceGroupColorMap = colorMap ? colorMap : new Map(
    networkTrace.traces.map(({group}, i) => [group, christianColors[i]])
  );
  const networkTraceLinks = networkTrace.traces.reduce((o, trace) => {
    const color = traceGroupColorMap.get(trace.group);
    trace._color = color;
    return o.concat(
      trace.edges.map(linkIdx => {
        const originLink = links[linkIdx];
        const link = {
          ...originLink,
          _color: color,
          _trace: trace
        };
        link.id += trace.group;
        let adjacentLinks = traceBasedLinkSplitMap.get(originLink);
        if (!adjacentLinks) {
          adjacentLinks = [];
          traceBasedLinkSplitMap.set(originLink, adjacentLinks);
        }
        adjacentLinks.push(link);
        return link;
      })
    );
  }, []);
  for (const adjacentLinkGroup of traceBasedLinkSplitMap.values()) {
    const adjacentLinkGroupLength = adjacentLinkGroup.length;
    // normalise only if multiple (skip /1)
    if (adjacentLinkGroupLength) {
      adjacentLinkGroup.forEach(l => {
        l._adjacent_divider = adjacentLinkGroupLength;
      });
    }
  }
  return networkTraceLinks;
};

export const getNetworkTraceNodes = (networkTraceLinks, nodes, id = defaultId) => {
  const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
  return [...networkTraceLinks.reduce((o, {source, target}) => {
    if (typeof source !== 'object') {
      source = find(nodeById, source);
    }
    if (typeof target !== 'object') {
      target = find(nodeById, target);
    }
    o.add(source);
    o.add(target);
    return o;
  }, new Set())];
};

export const colorNodes = (nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) => {
  // set colors for all node types
  const nodeCategories = new Set(nodes.map(nodeColorCategoryAccessor));
  const nodesColorMap = createMapToColor(
    nodeCategories,
    {
      hue: () => 0,
      lightness: (i, n) => {
        // all but not extreme (white, black)
        return (i + 1) / (n + 2);
      },
      saturation: () => 0
    }
  );
  nodes.forEach(node => {
    node._color = nodesColorMap.get(nodeColorCategoryAccessor(node));
  });
};

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
      return {
        ...node,
        color: '' + color,
        databaseLabel: node.type,
        label: Array.isArray(node.name) ? node.name[0] : node.name
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


export const colorByTraceEnding = ({sourceLinks, targetLinks, _color, _selected}: SankeyNode) => {
  const difference = symmetricDifference(sourceLinks, targetLinks, link => link._trace);
  if (difference.size === 1) {
    const traceColor = difference.values().next().value._trace._color;
    const labColor = cubehelix(_color);
    const calcColor = cubehelix(traceColor);
    calcColor.l = labColor.l;
    calcColor.opacity = _selected ? 1 : labColor.opacity;
    return calcColor;
  }
};

export const getRelatedTraces = ({nodes, links}) => {
  const nodesLinks = [...nodes].reduce(
    (linksAccumulator, {sourceLinks, targetLinks}) =>
      linksAccumulator.concat(sourceLinks, targetLinks)
    , []
  );
  return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
};
