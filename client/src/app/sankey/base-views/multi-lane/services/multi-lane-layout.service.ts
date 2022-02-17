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

  normalizeLinks = false;
  columns: SankeyNode[][] = [];
  columnsWithLinkPlaceholders: SankeyNode[][] = [];

  ky; // y scaling factor (_value * ky = height)

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
   * Once layout has been calculated we can safely delete placeholder nodes
   */
  cleanVirtualNodes(graph) {
    graph.nodes = graph._nodes;
  }
}
