import { Injectable, OnDestroy } from '@angular/core';

import { sum } from 'd3-array';
import { clone, first, last } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import {
  groupByTraceGroupWithAccumulation,
  LayersContext,
  LayoutService,
} from 'app/sankey/services/layout.service';
import { TruncatePipe } from 'app/shared/pipes/truncate.pipe';

import { DirectedTraversal } from '../../../utils/directed-traversal';
import { MultiLaneBaseControllerService } from './multi-lane-base-controller.service';
import { Base } from '../interfaces';
import { symmetricDifference } from '../../../utils';
import { EditService } from '../../../services/edit.service';

type MultilaneDataWithContext = LayersContext<Base>;

@Injectable()
export class MultiLaneLayoutService extends LayoutService<Base> implements OnDestroy {
  constructor(
    readonly baseView: MultiLaneBaseControllerService,
    protected readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService,
    protected readonly modalService: NgbModal,
    protected readonly update: EditService
  ) {
    super(baseView, truncatePipe, warningController, modalService, update);
    this.onInit();
  }

  get nodeColor() {
    return ({ sourceLinks, targetLinks, color }: Base['node']) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(sourceLinks, targetLinks, (link) => link.trace);
      // if there is only one trace start/end then color node with its color
      if (difference.size === 1) {
        return difference.values().next().value.trace.color;
      } else {
        return color;
      }
    };
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  /**
   * Similar to parent method however we are not having graph relaxation
   * node order is calculated by tree structure and this decision is final
   * It calculate nodes position by traversing it from side with less nodes as a tree
   * iteratively figuring order of the nodes.
   */
  computeNodeBreadths({ links }, columns) {
    // decide on direction
    const dt = new DirectedTraversal([first(columns), last(columns)]);
    // order next related nodes in order this group first appeared
    const sortByTrace: (links) => any = groupByTraceGroupWithAccumulation(dt.nextNode);
    const visited = new Set();
    let order = 0;
    const traceOrder = new Set();
    const relayoutLinks = (linksToTraverse) =>
      linksToTraverse.forEach((l) => {
        relayoutNodes([dt.nextNode(l)]);
        traceOrder.add(l.trace);
      });
    const relayoutNodes = (nodesToTraverse) =>
      nodesToTraverse.forEach((node) => {
        if (visited.has(node)) {
          return;
        }
        visited.add(node);
        node.order = order++;
        const sortedLinks = sortByTrace.call(this, dt.nextLinks(node));
        relayoutLinks(sortedLinks);
      });
    // traverse tree of connections
    relayoutNodes(dt.startNodes);

    const traces = [...traceOrder];
    const groups = clone(traces.map(({ group }) => group));

    const tracesLength = traces.length;
    links.forEach((link) => {
      link.order = sum([
        // save order by group
        groups.indexOf(link.trace.group),
        // top up with fraction to order by trace
        traces.indexOf(link.trace) / tracesLength,
      ]);
    });
  }
}
