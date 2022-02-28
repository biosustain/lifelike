import { Injectable } from '@angular/core';

import { sum } from 'd3-array';
import { first, last, clone } from 'lodash-es';
import { tap } from 'rxjs/operators';

import { TruncatePipe } from 'app/shared/pipes';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { LayoutService, groupByTraceGroupWithAccumulation, LayersContext } from 'app/sankey/services/layout.service';

import { DirectedTraversal } from '../../../utils/directed-traversal';
import { MultiLaneBaseControllerService } from './multi-lane-base-controller.service';
import { BaseOptions, BaseState, MultiLaneNetworkTraceData } from '../interfaces';

type MultilaneDataWithContext = LayersContext<MultiLaneNetworkTraceData>;

@Injectable()
export class MultiLaneLayoutService extends LayoutService<BaseOptions, BaseState> {
  constructor(
    readonly baseView: MultiLaneBaseControllerService,
    readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService
  ) {
    super(baseView, truncatePipe, warningController);
    this.onInit();
  }

  /**
   * Similar to parent method however we are not having graph relaxation
   * node order is calculated by tree structure and this decision is final
   * It calculate nodes position by traversing it from side with less nodes as a tree
   * iteratively figuring order of the nodes.
   */
  computeNodeBreadths = tap((graph: MultilaneDataWithContext) => {
    const {data: {links}, columns, ...context} = graph;
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
        const sortedLinks = sortByTrace(dt.nextLinks(node));
        relayoutLinks(sortedLinks);
      });
    // traverse tree of connections
    relayoutNodes(dt.startNodes);

    const traces = [...traceOrder];
    const groups = clone(traces.map(({group}) => group));

    const tracesLength = traces.length;
    links.forEach(link => {
      link._order = sum([
        // save order by group
        groups.indexOf(link._trace._group),
        // top up with fraction to order by trace
        traces.indexOf(link._trace) / tracesLength
      ]);
    });
  });
}
