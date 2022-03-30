import { Injectable, OnDestroy } from '@angular/core';

import { first, last } from 'lodash-es';
import { color } from 'd3-color';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { TruncatePipe } from 'app/shared/pipes';
import { DirectedTraversal } from 'app/sankey/utils/directed-traversal';
import { SankeyNode } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { LayoutService, LayersContext } from 'app/sankey/services/layout.service';
import { ServiceOnInit } from 'app/shared/schemas/common';

import { SingleLaneBaseControllerService } from './single-lane-base-controller.service';
import { BaseOptions, BaseState, SingleLaneNetworkTraceData } from '../interfaces';
import { SankeyUpdateService } from '../../../services/sankey-update.service';

type SinglelaneDataWithContext = LayersContext<SingleLaneNetworkTraceData>;

@Injectable()
export class SingleLaneLayoutService extends LayoutService<BaseOptions, BaseState> implements ServiceOnInit, OnDestroy {
  constructor(
    readonly baseView: SingleLaneBaseControllerService,
    protected readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService,
    protected readonly modalService: NgbModal,
    protected readonly update: SankeyUpdateService
  ) {
    super(baseView, truncatePipe, warningController, modalService, update);
    this.onInit();
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
  computeNodeBreadths(data, columns) {
    // decide on direction
    const dt = new DirectedTraversal([first(columns), last(columns)]);
    // order next related nodes in order this group first appeared
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
        const links = dt.nextLinks(node);
        relayoutLinks(links);
      });
    // traverse tree of connections
    relayoutNodes(dt.startNodes);
  }
}
