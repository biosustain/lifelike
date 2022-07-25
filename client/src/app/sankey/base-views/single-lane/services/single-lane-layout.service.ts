import { Injectable, OnDestroy } from '@angular/core';

import { first, last, sum, sumBy } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { tap, switchMap, startWith, map, take, takeUntil } from 'rxjs/operators';
import { interval, animationFrame } from 'rxjs';

import { TruncatePipe } from 'app/shared/pipes';
import { DirectedTraversal } from 'app/sankey/utils/directed-traversal';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { LayoutService, LayersContext } from 'app/sankey/services/layout.service';
import { ServiceOnInit } from 'app/shared/schemas/common';

import { SingleLaneBaseControllerService } from './single-lane-base-controller.service';
import { Base } from '../interfaces';
import { EditService } from '../../../services/edit.service';
import { debug } from 'app/shared/rxjs/debug';

type SinglelaneDataWithContext = LayersContext<Base>;

@Injectable()
export class SingleLaneLayoutService extends LayoutService<Base> implements ServiceOnInit, OnDestroy {
  constructor(
    readonly baseView: SingleLaneBaseControllerService,
    protected readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService,
    protected readonly modalService: NgbModal,
    protected readonly update: EditService
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
    const iterations = 10;
    return source => source.pipe(
      switchMap((verticalContext: any) => interval(500).pipe(
          take(iterations),
          takeUntil(this.destroyed$),
          map(iteration => {
            if (iteration === 0) {
              this.initializeNodeBreadths(columns, verticalContext);
            } else {
              const alpha = Math.pow(0.99, iteration);
              const beta = Math.max(1 - alpha, (iteration + 1) / iterations);
              this.relaxRightToLeft(columns, alpha, beta, verticalContext);
              this.relaxLeftToRight(columns, alpha, beta, verticalContext);
            }
            return verticalContext;
          }),
          tap(() => this.reorderLinks(data.nodes)),
        )
      )
    );
  }

  initializeNodeBreadths(columns, {ky, py, y0, y1}) {
    for (const nodes of columns) {
      let y = y0;
      for (const node of nodes) {
        node.y0 = y;
        node.y1 = y + node.value * ky;
        y = node.y1 + py;
        for (const link of node.sourceLinks) {
          link.width = link.value * ky;
        }
      }
      y = (y1 - y + py) / (nodes.length + 1);
      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i];
        node.y0 += y * (i + 1);
        node.y1 += y * (i + 1);
      }
      this.reorderLinks(nodes);
    }
  }

  // Reposition each node based on its incoming (target) links.
  relaxLeftToRight(columns, alpha, beta, verticalContext) {
    for (let i = 1, n = columns.length; i < n; ++i) {
      const column = columns[i];
      for (const target of column) {
        let y = 0;
        let w = 0;
        for (const {source, value} of target.targetLinks) {
          const v = value * (target.layer - source.layer);
          y += this.targetTop(source, target, verticalContext) * v;
          w += v;
        }
        if (!(w > 0)) {
          continue;
        }
        const dy = (y / w - target.y0) * alpha;
        target.y0 += dy;
        target.y1 += dy;
        this.reorderNodeLinks(target);
      }
      column.sort(SingleLaneLayoutService.ascendingBreadth);
      this.resolveCollisions(column, beta, verticalContext);
    }
  }

  // Reposition each node based on its outgoing (source) links.
  relaxRightToLeft(columns, alpha, beta, verticalContext) {
    for (let n = columns.length, i = n - 2; i >= 0; --i) {
      const column = columns[i];
      for (const source of column) {
        let y = 0;
        let w = 0;
        for (const {target, value} of source.sourceLinks) {
          const v = value * (target.layer - source.layer);
          y += this.sourceTop(source, target, verticalContext) * v;
          w += v;
        }
        if (!(w > 0)) {
          continue;
        }
        const dy = (y / w - source.y0) * alpha;
        source.y0 += dy;
        source.y1 += dy;
        this.reorderNodeLinks(source);
      }
      column.sort(SingleLaneLayoutService.ascendingBreadth);
      this.resolveCollisions(column, beta, verticalContext);
    }
  }

  resolveCollisions(nodes, alpha, verticalContext) {
    const {py, y0, y1} = verticalContext;
    // tslint:disable-next-line:no-bitwise
    const i = nodes.length >> 1;
    const subject = nodes[i];
    this.resolveCollisionsBottomToTop(nodes, subject.y0 - py, i - 1, alpha, verticalContext);
    this.resolveCollisionsTopToBottom(nodes, subject.y1 + py, i + 1, alpha, verticalContext);
    this.resolveCollisionsBottomToTop(nodes, y1, nodes.length - 1, alpha, verticalContext);
    this.resolveCollisionsTopToBottom(nodes, y0, 0, alpha, verticalContext);
  }

  // Push any overlapping nodes down.
  resolveCollisionsTopToBottom(nodes, y, i, alpha, {py}) {
    for (; i < nodes.length; ++i) {
      const node = nodes[i];
      const dy = (y - node.y0) * alpha;
      if (dy > 1e-6) {
        node.y0 += dy, node.y1 += dy;
      }
      y = node.y1 + py;
    }
  }

  // Push any overlapping nodes up.
  resolveCollisionsBottomToTop(nodes, y, i, alpha, {py}) {
    for (; i >= 0; --i) {
      const node = nodes[i];
      const dy = (node.y1 - y) * alpha;
      if (dy > 1e-6) {
        node.y0 -= dy, node.y1 -= dy;
      }
      y = node.y0 - py;
    }
  }

  reorderNodeLinks({sourceLinks, targetLinks}) {
    if (this.linkSort === undefined) {
      // tslint:disable-next-line:no-shadowed-variable
      for (const {source: {sourceLinks}} of targetLinks) {
        sourceLinks.sort(SingleLaneLayoutService.ascendingTargetBreadth);
      }
      // tslint:disable-next-line:no-shadowed-variable
      for (const {target: {targetLinks}} of sourceLinks) {
        targetLinks.sort(SingleLaneLayoutService.ascendingSourceBreadth);
      }
    }
  }

  reorderLinks(nodes) {
    for (const {sourceLinks, targetLinks} of nodes) {
      sourceLinks.sort(SingleLaneLayoutService.ascendingTargetBreadth);
      targetLinks.sort(SingleLaneLayoutService.ascendingSourceBreadth);
    }
  }

  // Returns the target.y0 that would produce an ideal link from source to target.
  targetTop(source, target, {py}) {
    let y = source.y0 - (source.sourceLinks.length - 1) * py / 2;
    for (const {target: node, width} of source.sourceLinks) {
      if (node === target) {
        break;
      }
      y += width + py;
    }
    for (const {source: node, width} of target.targetLinks) {
      if (node === source) {
        break;
      }
      y -= width;
    }
    return y;
  }

  // Returns the source.y0 that would produce an ideal link from source to target.
  sourceTop(source, target, {py}) {
    let y = target.y0 - (target.targetLinks.length - 1) * py / 2;
    for (const {source: node, width} of target.targetLinks) {
      if (node === source) {
        break;
      }
      y += width + py;
    }
    for (const {target: node, width} of source.sourceLinks) {
      if (node === target) {
        break;
      }
      y -= width;
    }
    return y;
  }
}
