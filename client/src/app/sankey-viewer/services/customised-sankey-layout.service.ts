import { Injectable } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { DirectedTraversal } from './directed-traversal';
import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import { christianColors, createMapToColor, nodeLabelAccessor } from '../components/utils';

const groupByTraceGroupWithAccumulation = () => {
  const traceGroupOrder = new Set();
  return links => {
    links.forEach(({_trace}) => {
      traceGroupOrder.add(_trace.group);
    });
    const groups = [...traceGroupOrder];
    return links.sort((a, b) =>
      (groups.indexOf(a._trace.group) - groups.indexOf(b._trace.group))
    );
  };
};

interface SizeLimit {
  enabled?: boolean;
  value?: number;
  ratio?: number;
}

@Injectable()
export class CustomisedSankeyLayoutService extends SankeyLayoutService {
  // height adjustments
  nodeHeight = {
    max: {} as SizeLimit,
    min: {} as SizeLimit
  };

  // @ts-ignore
  labelEllipsis: SizeLimit = {
    enabled: true,
    value: 10
  };

  get shortNodeText() {
    const {labelEllipsis: {value, enabled}} = this;
    if (enabled) {
      return n => nodeLabelAccessor(n).slice(0, value);
    } else {
      return n => nodeLabelAccessor(n);
    }
  }

  get ellipsed() {
    const {labelEllipsis: {value, enabled}} = this;
    if (enabled) {
      return n => nodeLabelAccessor(n).length > value;
    } else {
      return _ => false;
    }
  }

  getYScaleFactor(columns, nodes) {
    const {y1, y0, py, dx, nodeHeight} = this;
    const ky = min(columns, c => (y1 - y0 - (c.length - 1) * py) / sum(c, CustomisedSankeyLayoutService.value));
    let scale = 1;
    if (nodeHeight.max.enabled) {
      const maxCurrentHeight = max(nodes, ({value}) => value) * ky;
      if (nodeHeight.max.ratio) {
        const maxScalling = dx * nodeHeight.max.ratio / maxCurrentHeight;
        if (maxScalling < 1) {
          scale *= maxScalling;
        }
      }
    }
    if (nodeHeight.min.enabled) {
      const minCurrentHeight = min(nodes, ({value}) =>
        value || Infinity // ignore zeros
      ) * ky;
      if (nodeHeight.min.value) {
        const minScalling = nodeHeight.min.value / minCurrentHeight;
        if (minScalling > 1) {
          scale *= minScalling;
        }
      }
    }
    return ky * scale;
  }

  // @ts-ignore
  initializeNodeBreadths(columns, graph) {
    const ky = this.getYScaleFactor(columns, graph.nodes);

    const [[_marginLeft, marginTop]] = this.extent;
    const [_width, height] = this.size;

    const firstColumn = columns[0];
    const lastColumn = columns[columns.length - 1];

    const dt = new DirectedTraversal([firstColumn, lastColumn]);
    const sortByTrace: (links) => any = groupByTraceGroupWithAccumulation();
    const visited = new Set();
    let order = 0;
    const traceOrder = new Set();
    const relayoutLinks = linksToTraverse =>
      linksToTraverse.forEach(l => {
        relayoutNodes([dt.nextNode(l)]);
        traceOrder.add(l._trace);
      });
    const relayoutNodes = nodesToTraverse =>
      nodesToTraverse.forEach(node => {
        if (visited.has(node)) {
          return;
        }
        visited.add(node);
        node._order = order++;
        const links = sortByTrace(dt.nextLinks(node));
        relayoutLinks(links);
      });
    relayoutNodes(dt.startNodes);

    const traces = [...traceOrder];
    const groups = [...traces.map(({group}) => group)];

    this.linkSort = (a, b) => (
      (a.source._order - b.source._order) ||
      (a.target._order - b.target._order) ||
      (groups.indexOf(a._trace.group) - groups.indexOf(b._trace.group)) ||
      (traces.indexOf(a._trace) - traces.indexOf(b._trace))
    );

    columns.forEach(nodes => {
      const {length} = nodes;
      const nodesHeight = sum(nodes, ({value}) => value) * ky;
      const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
      const freeSpace = height - nodesHeight;
      const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
      let y = additionalSpacers ? spacerSize + marginTop : marginTop;
      nodes.sort((a, b) => a._order - b._order).forEach(node => {
        const nodeHeight = node.value * ky;
        node.y0 = y;
        node.y1 = y + nodeHeight;
        y += nodeHeight + spacerSize;

        for (const link of node.sourceLinks) {
          link.width = link.value * ky;
        }
      });
      for (const {sourceLinks, targetLinks} of nodes) {
        sourceLinks.sort(this.linkSort);
        targetLinks.sort(this.linkSort);
      }
      // todo: replace with
      // this.reorderLinks(nodes);
    });
  }

  computeNodeBreadths(graph) {
    const {dy, y1, y0} = this;
    const columns = this.computeNodeLayers(graph);
    this.py = Math.min(dy, (y1 - y0) / (max(columns, c => c.length) - 1));
    this.initializeNodeBreadths(columns, graph);
  }

  calcLayout(graph) {
    // Process the graph's nodes and links, setting their positions

    // Associate the nodes with their respective links, and vice versa
    this.computeNodeLinks(graph);
    // Determine which links result in a circular path in the graph
    // this.identifyCircles(graph);
    // Calculate the nodes' values, based on the values of the incoming and outgoing links
    this.computeNodeValues(graph);
    // Calculate the nodes' depth based on the incoming and outgoing links
    //     Sets the nodes':
    //     - depth:  the depth in the graph
    //     - column: the depth (0, 1, 2, etc), as is relates to visual position from left to right
    //     - x0, x1: the x coordinates, as is relates to visual position from left to right
    this.computeNodeDepths(graph);
    this.computeNodeHeights(graph);
    // Calculate the nodes' and links' vertical position within their respective column
    //     Also readjusts sankeyCircular size if circular links are needed, and node x's
    this.computeNodeBreadths(graph);
    SankeyLayoutService.computeLinkBreadths(graph);
    return graph;
  }

  // Trace logic
  getAndColorNetworkTraceLinks(networkTrace, links, colorMap?) {
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
  }

  getNetworkTraceNodes(networkTraceLinks, nodes) {
    const {id} = this;
    const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
    return [
      ...networkTraceLinks.reduce((o, {source, target}) => {
        if (typeof source !== 'object') {
          source = SankeyLayoutService.find(nodeById, source);
        }
        if (typeof target !== 'object') {
          target = SankeyLayoutService.find(nodeById, target);
        }
        o.add(source);
        o.add(target);
        return o;
      }, new Set())
    ];
  }

  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
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
  }

  getRelatedTraces({nodes, links}) {
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {sourceLinks, targetLinks}) =>
        linksAccumulator.concat(sourceLinks, targetLinks)
      , []
    );
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
  }
}
