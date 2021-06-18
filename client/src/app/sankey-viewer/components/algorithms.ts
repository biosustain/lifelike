import * as d3Sankey from 'd3-sankey-circular';
import { uuidv4 } from '../../shared/utils';
import { nodeLabelAccessor, christianColors, createMapToColor, representativePositiveNumber, symmetricDifference } from './sankey/utils';
import { find, defaultId } from './sankey/d3-sankey';
import { GraphData } from '../../interfaces/vis-js.interface';
import { cubehelix } from 'd3';

export const fractionOfFixedNodeValue = ({links, nodes}) => {
  links.forEach(l => l.value = 1);
  d3Sankey.sankeyCircular()
    .nodeId(n => n.id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  links.forEach(l => {
    const [sv, tv] = l.multiple_values = [
      l.source.fixedValue / l.source.sourceLinks.length,
      l.target.fixedValue / l.target.targetLinks.length
    ];
    l.value = (sv + tv) / 2;
  });
  return {
    nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0),
    links: links.map(
      ({
         value = 0.001,
         ...link
       }) => ({
        ...link,
        value
      })),
    _sets: {
      link: {
        value: true
      }
    }
  };
};

export const inputCount = ({links, nodes, inNodes}) => {
  links.forEach(l => l.value = 1);
  d3Sankey.sankeyCircular()
    .nodeId(n => n.id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  nodes.sort((a, b) => a.depth - b.depth).forEach(n => {
    if (inNodes.includes(n.id)) {
      n.value = 1;
    } else {
      n.value = 0;
    }
    n.value = n.targetLinks.reduce((a, l) => a + l.value, n.value || 0);
    const outFrac = n.value / n.sourceLinks.length;
    n.sourceLinks.forEach(l => {
      l.value = outFrac;
    });
  });
  return {
    nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0),
    links: links.map(({
                        value = 0.001,
                        ...link
                      }) => ({
      ...link,
      value
    })),
    _sets: {
      link: {
        value: true
      }
    }
  };
};

export const noneNodeValue = ({nodes}) => {
  nodes.forEach(n => {
    delete n.fixedValue;
    delete n.value;
  });
  return {
    _sets: {
      node: {
        fixedValue: false,
        value: false
      }
    }
  };
};

export const linkSizeByProperty = property => ({links}) => {
  links.forEach(l => {
    l.value = representativePositiveNumber(l[property]) / (l._adjacent_divider || 1);
  });
  return {
    _sets: {
      link: {
        value: true
      }
    }
  };
};

export const linkSizeByArrayProperty = property => ({links}) => {
  links.forEach(l => {
    const [v1, v2] = l[property];
    l.multiple_values = [v1, v2].map(d => representativePositiveNumber(d) / (l._adjacent_divider || 1));
    // take max for layer calculation
    l.value = Math.max(...l.multiple_values);
  });
  return {
    _sets: {
      link: {
        multiple_values: true,
        value: true
      }
    }
  };
};

export const nodeValueByProperty = property => ({nodes}) => {
  nodes.forEach(n => {
    n.fixedValue = representativePositiveNumber(n[property]);
  });
  return {
    _sets: {
      node: {
        fixedValue: true
      }
    }
  };
};

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

export const getAndColorNetworkTraceLinks = (networkTrace, links, colorMap = ({group}, i) => [group, christianColors[i]]) => {
  const traceBasedLinkSplitMap = new Map();
  const traceGroupColorMap = new Map(
    networkTrace.traces.map(colorMap)
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

export const getTraceDetailsGraph = (trace, {nodes: mainNodes}) => {
  const edges = trace.detail_edges.map(([from, to, d]) => ({
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
  const nodes = nodeIds.map((nodeId, idx) => {
    const node = mainNodes[nodeId];
    if (node) {
      return {
        ...node,
        databaseLabel: node.type,
        label: node.name[0]
      };
    } else {
      return {
        id: nodeId
      };
    }
  });
  return {
    edges,
    nodes: nodes.map(n => ({
      ...n,
      color: undefined
    }))
  } as GraphData;
};


export const colorByTraceEnding = ({sourceLinks, targetLinks, _color, _selected}: Node) => {
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
