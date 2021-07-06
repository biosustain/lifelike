import { find, defaultId } from './d3-sankey/d3-sankey';
import { createMapToColor, christianColors } from '../utils';

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

export const getRelatedTraces = ({nodes, links}) => {
  const nodesLinks = [...nodes].reduce(
    (linksAccumulator, {sourceLinks, targetLinks}) =>
      linksAccumulator.concat(sourceLinks, targetLinks)
    , []
  );
  return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
};
