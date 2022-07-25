import { Injectable, OnDestroy } from '@angular/core';

import { sum } from 'd3-array';
import { first, last, clone } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { tap } from 'rxjs/operators';

import { TruncatePipe } from 'app/shared/pipes';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { LayoutService, groupByTraceGroupWithAccumulation, LayersContext } from 'app/sankey/services/layout.service';

import { DirectedTraversal } from '../../../utils/directed-traversal';
import { MultiLaneBaseControllerService } from './multi-lane-base-controller.service';
import { Base } from '../interfaces';
import { symmetricDifference } from '../../../utils';
import { EditService } from '../../../services/edit.service';

/**
 * Layout relaxation is based on d3-sankey code
 *
 * Copyright 2015, Mike Bostock
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * Neither the name of the author nor the names of contributors may be used to
 *   endorse or promote products derived from this software without specific prior
 *   written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


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
    return ({sourceLinks, targetLinks, color}: Base['node']) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(sourceLinks, targetLinks, link => link.trace);
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
  computeNodeBreadths(data, columns) {
    return source => source.pipe(
      tap((verticalContext: any) => {
        // decide on direction
        const dt = new DirectedTraversal([first(columns), last(columns)]);
        // order next related nodes in order this group first appeared
        const sortByTrace: (links) => any = groupByTraceGroupWithAccumulation(dt.nextNode);
        const visited = new Set();
        let order = 0;
        const traceOrder = new Set();
        const relayoutLinks = linksToTraverse =>
          linksToTraverse.forEach(l => {
            relayoutNodes([dt.nextNode(l)]);
            traceOrder.add(l.trace);
          });
        const relayoutNodes = nodesToTraverse =>
          nodesToTraverse.forEach(node => {
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
        const groups = clone(traces.map(({group}) => group));

        const tracesLength = traces.length;
        data.links.forEach(link => {
          link.order = sum([
            // save order by group
            groups.indexOf(link.trace.group),
            // top up with fraction to order by trace
            traces.indexOf(link.trace) / tracesLength
          ]);
        });
      })
    );
  }
}
