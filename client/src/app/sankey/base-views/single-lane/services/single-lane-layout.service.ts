import { Injectable } from '@angular/core';

import { first, last } from 'lodash-es';
import { color } from 'd3-color';

import { TruncatePipe } from 'app/shared/pipes';
import { DirectedTraversal } from 'app/sankey/utils/directed-traversal';
import { SankeyNode } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { BaseControllerService } from 'app/sankey/services/base-controller.service';
import { LayoutService } from 'app/sankey/services/layout.service';

import { SingleLaneBaseControllerService } from './single-lane-base-controller.service';
import { BaseOptions, BaseState } from '../interfaces';

@Injectable()
export class SingleLaneLayoutService extends LayoutService<BaseOptions, BaseState> {
  constructor(
    readonly baseView: SingleLaneBaseControllerService,
    readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService
  ) {
    super(baseView, truncatePipe, warningController);
  }

  get linkBorder() {
    return ({_color}) => _color ? color(_color).darker(0.5) : _color;
  }

  get nodeColor() {
    return ({_color}: SankeyNode) => {
      return _color;
    };
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


    this.layoutNodesWithinColumns(columns);
  }
}
