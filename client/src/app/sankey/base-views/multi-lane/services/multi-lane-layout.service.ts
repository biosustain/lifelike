import { Injectable, Inject, forwardRef } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { first, last, clone } from 'lodash-es';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyNode, NetworkTraceData } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { LayoutService, groupByTraceGroupWithAccumulation } from 'app/sankey/services/layout.service';

import { DirectedTraversal } from '../../../utils/directed-traversal';
import { MultiLaneBaseControllerService } from './multi-lane-base-controller.service';
import { SankeyMultiLaneOptions, SankeyMultiLaneState, BaseOptions, BaseState } from '../interfaces';
import { symmetricDifference } from '../../../utils/utils';

@Injectable()
export class MultiLaneLayoutService extends LayoutService<BaseOptions, BaseState> {
  constructor(
    readonly baseView: MultiLaneBaseControllerService,
    readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService
  ) {
    super(baseView, truncatePipe, warningController);
  }

  get nodeColor() {
    return ({_sourceLinks, _targetLinks, _color}: SankeyNode) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);
      // if it is only one then color node
      if (difference.size === 1) {
        return difference.values().next().value._trace._color;
      } else {
        return _color;
      }
    };
  }

  normalizeLinks = false;
  columns: SankeyNode[][] = [];
  columnsWithLinkPlaceholders: SankeyNode[][] = [];

  ky; // y scaling factor (_value * ky = height)

  /**
   * Compose SVG path based on set of intermediate points
   */
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

  /**
   * Adjust Y scale factor based on columns and min/max node height
   */
  getYScaleFactor(nodes) {
    const {
      vertical: {y1, y0}, py, dx, nodeHeight, value, columnsWithLinkPlaceholders: columns
    } = this;
    // normal calculation based on tallest column
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
    return ky * scale;
  }

  linkSort = (a, b) => (
    // sort by order given in tree traversal
    (a._source._order - b._source._order) ||
    (a._target._order - b._target._order) ||
    (a._order - b._order)
  )

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
          if (!link._circular) {
            next.add(link[nextNodeProperty] as SankeyNode);
          }
        }
      }
      if (++x > n) {
        throw new Error('Unaddressed circular link');
      }
      current = next;
      next = new Set();
    }
  };


  /**
   * Same as parent method just ignoring circular links
   */
  computeNodeHeights({nodes}: NetworkTraceData) {
    const {
      ky, nodeHeight, value
    } = this;
    for (const node of nodes) {
      if (nodeHeight.min.enabled && nodeHeight.min.value) {
        node._height = Math.max(value(node) * ky, nodeHeight.min.value);
      } else {
        node._height = value(node) * ky;
      }
    }
  }

  layoutNodesWithinColumns(columns) {
    const {ky} = this;

    const {y0, height} = this.vertical;

    columns.forEach(nodes => {
      const {length} = nodes;
      const nodesHeight = sum(nodes, ({_height}) => _height);
      // do we want space above and below nodes or should it fill column till the edges?
      const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
      const freeSpace = height - nodesHeight;
      const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
      let y = additionalSpacers ? spacerSize + y0 : y0;
      // nodes are placed in order from tree traversal
      nodes.sort((a, b) => a._order - b._order).forEach(node => {
        const nodeHeight = node._height;
        node._y0 = y;
        node._y1 = y + nodeHeight;
        y += nodeHeight + spacerSize;

        // apply the y scale on links
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

  /**
   * Similar to parent method however we are not having graph relaxation
   * node order is calculated by tree structure and this decision is final
   * It calculate nodes position by traversing it from side with less nodes as a tree
   * iteratively figuring order of the nodes.
   */
  computeNodeBreadths(graph) {
    const {columns} = this;

    // decide on direction
    const dt = new DirectedTraversal([first(columns), last(columns)]);
    // order next related nodes in order this group first appeared
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
    // traverse tree of connections
    relayoutNodes(dt.startNodes);

    const traces = [...traceOrder];
    const groups = clone(traces.map(({group}) => group));

    const tracesLength = traces.length;
    graph.links.forEach(link => {
      link._order = sum([
        // save order by group
        groups.indexOf(link._trace._group),
        // top up with fraction to order by trace
        traces.indexOf(link._trace) / tracesLength
      ]);
    });

    this.layoutNodesWithinColumns(columns);
  }

  /**
   * Helper so we can create columns copy with minimum overhead
   */
  getColumnsCopy() {
    return this.columns.map(clone);
  }

  /**
   * If link spawns on multiple columns (both normal and circular) on each intermediate
   * column place placeholder node with height of this link.
   * For best results this method places only one node with summed for all links going from the
   * same source to same target node.
   * This approach reduces overlays in more complex graphs
   */
  createVirtualNodes(graph) {
    this.columnsWithLinkPlaceholders = this.getColumnsCopy();
    // create graph backup
    graph._nodes = graph.nodes;
    // and start to operate on substitutes
    graph.nodes = clone(graph.nodes);
    const _virtualPaths = new Map();

    for (const link of graph.links) {
      const totalToCreate = Math.abs(link._target._layer - link._source._layer);

      // if the link spans more than 1 column, then replace it with virtual nodes and links
      if (totalToCreate > 1) {
        const startNode = link._circular ? link._target : link._source;

        const id = link._source.id + ' ' + link._target.id;
        const virtualPath = _virtualPaths.get(id) ?? [];
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

  /**
   * Once layout has been calculated we can safely delete placeholder nodes
   */
  cleanVirtualNodes(graph) {
    graph.nodes = graph._nodes;
  }

  setLayoutParams(graph) {
    const {dy, vertical: {y1, y0}} = this;
    this.py = Math.min(dy, (y1 - y0) / (max(this.columnsWithLinkPlaceholders, c => c.length) - 1));
    this.ky = this.getYScaleFactor(graph.nodes);
  }
}
