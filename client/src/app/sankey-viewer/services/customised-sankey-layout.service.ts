import { Injectable } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { DirectedTraversal } from './directed-traversal';
import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import { normalizeGenerator, symmetricDifference } from '../components/sankey/utils';
import { christianColors, createMapToColor } from '../components/color-palette';
import { SankeyNode, SankeyData } from '../components/interfaces';

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
// @ts-ignore
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

  fontSizeScale = 1.0;

  normalizeLinks = false;

  columns;
  columnsWithLinkPlaceholders;

  calculateLinkPathParams(link, normalize = true) {
    const {_source, _target, _multiple_values} = link;
    let {_value: linkValue} = link;
    linkValue = linkValue || 1e-4;
    const sourceX = _source._x1;
    const targetX = _target._x0;
    const {_sourceLinks} = _source;
    const {_targetLinks} = _target;
    const sourceIndex = _sourceLinks.indexOf(link);
    const targetIndex = _targetLinks.indexOf(link);
    const columns = Math.abs(_target._layer - _source._layer);
    const linkWidth = Math.abs(targetX - sourceX);
    const bezierOffset = (link._circular ? linkWidth / columns : linkWidth) / 2;
    const sourceBezierX = sourceX + bezierOffset;
    const targetBezierX = targetX - bezierOffset;
    let sourceY0;
    let sourceY1;
    let targetY0;
    let targetY1;
    let sourceY = 0;
    let targetY = 0;

    if (_multiple_values) {
      for (let i = 0; i < sourceIndex; i++) {
        sourceY += _sourceLinks[i]._multiple_values[0];
      }
      for (let i = 0; i < targetIndex; i++) {
        targetY += _targetLinks[i]._multiple_values[1];
      }
    } else {
      for (let i = 0; i < sourceIndex; i++) {
        sourceY += _sourceLinks[i]._value;
      }
      for (let i = 0; i < targetIndex; i++) {
        targetY += _targetLinks[i]._value;
      }
    }

    if (normalize) {
      let sourceValues;
      let targetValues;
      if (_multiple_values) {
        sourceValues = _sourceLinks.map(({_multiple_values: [value]}) => value);
        targetValues = _targetLinks.map(({_multiple_values: [_, value]}) => value);
      } else {
        sourceValues = _sourceLinks.map(({_value}) => _value);
        targetValues = _targetLinks.map(({_value}) => _value);
      }
      const sourceNormalizer = _sourceLinks._normalizer || (_sourceLinks._normalizer = normalizeGenerator(sourceValues));
      const targetNormalizer = _targetLinks._normalizer || (_targetLinks._normalizer = normalizeGenerator(targetValues));
      const sourceHeight = _source._y1 - _source._y0;
      const targetHeight = _target._y1 - _target._y0;
      // tslint:disable-next-line:no-bitwise
      sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + _source._y0;
      // tslint:disable-next-line:no-bitwise
      targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + _target._y0;
      if (_multiple_values) {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = (sourceNormalizer.normalize(_multiple_values[0]) * sourceHeight) + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = (targetNormalizer.normalize(_multiple_values[1]) * targetHeight) + targetY0;
      } else {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
      }
    } else {
      let {_width} = link;
      _width = _width || 1e-4;
      const valueScaler = _width / linkValue;

      // tslint:disable-next-line:no-bitwise
      sourceY0 = sourceY * valueScaler + _source._y0;
      // tslint:disable-next-line:no-bitwise
      targetY0 = targetY * valueScaler + _target._y0;
      if (_multiple_values) {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = _multiple_values[0] * valueScaler + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = _multiple_values[1] * valueScaler + targetY0;
      } else {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = linkValue * valueScaler + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = linkValue * valueScaler + targetY0;
      }
    }
    return {
      sourceX,
      sourceY0,
      sourceY1,
      targetX,
      targetY0,
      targetY1,
      sourceBezierX,
      targetBezierX
    };
  }

  composeLinkPath({
                    sourceX,
                    sourceY0,
                    sourceY1,
                    targetX,
                    targetY0,
                    targetY1,
                    sourceBezierX,
                    targetBezierX
                  }) {
    return (
      `M${sourceX} ${sourceY0}` +
      `C${sourceBezierX} ${sourceY0},${targetBezierX} ${targetY0},${targetX} ${targetY0}` +
      `L${targetX} ${targetY1}` +
      `C${targetBezierX} ${targetY1},${sourceBezierX} ${sourceY1},${sourceX} ${sourceY1}` +
      `Z`
    );
  }

  get linkPath() {
    const {
      calculateLinkPathParams,
      composeLinkPath,
      normalizeLinks
    } = this;
    return link => {
      link._calculated_params = calculateLinkPathParams(link, normalizeLinks);
      return composeLinkPath(link._calculated_params);
    };
  }

  get nodeLabelShort() {
    const {
      labelEllipsis: {
        value,
        enabled
      },
      nodeLabel,
      truncatePipe: { transform }
    } = this;
    if (enabled) {
      return n => transform(nodeLabel(n), value);
    } else {
      return n => nodeLabel(n);
    }
  }

  get nodeLabelShouldBeShorted() {
    const {
      labelEllipsis: {
        value,
        enabled
      },
      nodeLabel
    } = this;
    if (enabled) {
      return n => nodeLabel(n).length > value;
    } else {
      return _ => false;
    }
  }

  get nodeColor() {
    return ({_sourceLinks, _targetLinks, _color}: SankeyNode) => {
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);
      if (difference.size === 1) {
        return difference.values().next().value._trace._color;
      } else {
        return _color;
      }
    };
  }

  get fontSize() {
    const { fontSizeScale } = this;
    // noinspection JSUnusedLocalSymbols
    return (d?, i?, n?) => 12 * fontSizeScale;
  }

  getYScaleFactor(nodes) {
    const {y1, y0, py, dx, nodeHeight, value, columnsWithLinkPlaceholders: columns} = this;
    const ky = min(columns, c => (y1 - y0 - (c.length - 1) * py) / sum(c, value));
    let scale = 1;
    if (nodeHeight.max.enabled) {
      const maxCurrentHeight = max(nodes, value) * ky;
      if (nodeHeight.max.ratio) {
        const maxScaling = dx * nodeHeight.max.ratio / maxCurrentHeight;
        if (maxScaling < 1) {
          scale *= maxScaling;
        }
      }
    }
    if (nodeHeight.min.enabled) {
      const minCurrentHeight = min(nodes, n =>
        value(n) || Infinity // ignore zeros
      ) * ky;
      if (nodeHeight.min.value) {
        const minScaling = nodeHeight.min.value / minCurrentHeight;
        if (minScaling > 1) {
          scale *= minScaling;
        }
      }
    }
    return ky * scale;
  }

  // @ts-ignore
  initializeNodeBreadths(graph) {
    const {columns} = this;
    const ky = this.getYScaleFactor(graph.nodes);

    // noinspection JSUnusedLocalSymbols
    const [[_marginLeft, marginTop]] = this.extent;
    // noinspection JSUnusedLocalSymbols
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
      (a._source._order - b._source._order) ||
      (a._target._order - b._target._order) ||
      (groups.indexOf(a._trace.group) - groups.indexOf(b._trace.group)) ||
      (traces.indexOf(a._trace) - traces.indexOf(b._trace))
    );

    columns.forEach(nodes => {
      const {length} = nodes;
      const nodesHeight = sum(nodes, ({_value}) => _value) * ky;
      const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
      const freeSpace = height - nodesHeight;
      const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
      let y = additionalSpacers ? spacerSize + marginTop : marginTop;
      nodes.sort((a, b) => a._order - b._order).forEach(node => {
        const nodeHeight = node._value * ky;
        node._y0 = y;
        node._y1 = y + nodeHeight;
        y += nodeHeight + spacerSize;

        for (const link of node._sourceLinks) {
          link._width = link._value * ky;
        }
      });
      for (const {_sourceLinks, _targetLinks} of nodes) {
        _sourceLinks.sort(this.linkSort);
        _targetLinks.sort(this.linkSort);
      }
      // todo: replace with
      // this.reorderLinks(nodes);
    });
  }

  computeNodeDepths({nodes}: SankeyData) {
    const n = nodes.length;
    let current = new Set<SankeyNode>(nodes);
    let next = new Set<SankeyNode>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        node._depth = x;
        for (const {_target, _circular} of node._sourceLinks) {
          if (!_circular) {
            next.add(_target as SankeyNode);
          }
        }
      }
      if (++x > n) {
        throw new Error('Unaddressed circular link');
      }
      current = next;
      next = new Set();
    }
  }

  computeNodeHeights({nodes}: SankeyData) {
    const n = nodes.length;
    let current = new Set(nodes);
    let next = new Set<SankeyNode>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        // noinspection JSSuspiciousNameCombination
        node._height = x;
        for (const {_source, _circular} of node._targetLinks) {
          if (!_circular) {
            next.add(_source as SankeyNode);
          }
        }
      }
      if (++x > n) {
        throw new Error('Unaddressed circular link');
      }
      current = next;
      next = new Set();
    }
  }

  computeNodeBreadths(graph) {
    const {dy, y1, y0} = this;
    this.columns = this.computeNodeLayers(graph);
    this.createVirtualNodes(graph);
    this.py = Math.min(dy, (y1 - y0) / (max(this.columnsWithLinkPlaceholders, c => c.length) - 1));
    this.initializeNodeBreadths(graph);
  }

  getColumnsCopy() {
    return this.columns.map(c => [...c]);
  }

  createVirtualNodes(graph) {
    this.columnsWithLinkPlaceholders = this.getColumnsCopy();
    // create graph backup
    graph._nodes = graph.nodes;
    // and start to operate on substitutes
    graph.nodes = [...graph.nodes];
    const _virtualPaths = new Map();

    for (const link of graph.links) {
      const totalToCreate = Math.abs(link._target._layer - link._source._layer);

      // if the link spans more than 1 column, then replace it with virtual nodes and links
      if (totalToCreate > 1) {
        const startNode = link._circular ? link._target : link._source;

        const id = link._source.id + ' ' + link._target.id;
        const virtualPath = _virtualPaths.get(id) || [];
        _virtualPaths.set(id, virtualPath);

        let newNode;
        for (let n = 1; n < totalToCreate; n++) {
          newNode = virtualPath[n];
          if (!newNode) {
            newNode = {
              _value: 0,
              _layer: startNode._layer + n
            } as SankeyNode;
            virtualPath.push(newNode);
            this.columnsWithLinkPlaceholders[newNode._layer].push(newNode);
          }
          newNode._value += link._value;
        }
      }
    }
  }

  cleanVirtualLinksAndNodes(graph) {
    graph.nodes = graph._nodes;
  }

  calcLayout(graph) {
    // Process the graph's nodes and links, setting their positions

    // Associate the nodes with their respective links, and vice versa
    this.computeNodeLinks(graph);
    // Determine which links result in a circular path in the graph
    this.identifyCircles(graph);
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
    this.cleanVirtualLinksAndNodes(graph);
    return graph;
  }

  // Trace logic
  getAndColorNetworkTraceLinks(networkTrace, links, colorMap?) {
    const traceBasedLinkSplitMap = new Map();
    const traceGroupColorMap = colorMap ? colorMap : new Map(
      networkTrace.traces.map(({group}) => [group, christianColors[group]])
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

  getNodeById(nodes) {
    const {id} = this;
    return new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
  }

  getNetworkTraceNodes(networkTraceLinks, nodes) {
    const nodeById = this.getNodeById(nodes);
    return [
      ...networkTraceLinks.reduce((o, link) => {
        let {_source = link.source, _target = link.target} = link;
        if (typeof _source !== 'object') {
          _source = SankeyLayoutService.find(nodeById, _source);
        }
        if (typeof _target !== 'object') {
          _target = SankeyLayoutService.find(nodeById, _target);
        }
        o.add(_source);
        o.add(_target);
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
        saturation: () => 0,
        alpha: () => 0.75
      }
    );
    nodes.forEach(node => {
      node._color = nodesColorMap.get(nodeColorCategoryAccessor(node));
    });
  }

  getRelatedTraces({nodes, links}) {
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {_sourceLinks, _targetLinks}) =>
        linksAccumulator.concat(_sourceLinks, _targetLinks)
      , []
    );
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
  }
}
