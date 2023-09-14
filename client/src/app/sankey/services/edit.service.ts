import { Injectable } from '@angular/core';

import { BehaviorSubject, ReplaySubject, combineLatest, Subject } from 'rxjs';
import { scan, switchMap, map, startWith, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { minBy } from 'lodash-es';
import { uniq, maxBy } from 'lodash';

import { isNotEmpty } from 'app/shared/utils';

import { SankeyNode } from '../model/sankey-document';

@Injectable()
export class EditService {
  readonly reset$ = new BehaviorSubject<any>(false);
  readonly movedNode$ = new Subject<SankeyNode>();
  readonly movedNodes$ = this.reset$.pipe(
    switchMap(() =>
      this.movedNode$.pipe(
        startWith([] as SankeyNode[]),
        scan((movedNodes: SankeyNode[], node: SankeyNode) => uniq([...movedNodes, node]))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly edited$ = this.movedNodes$.pipe(
    map((movedNodes) => isNotEmpty(movedNodes)),
    distinctUntilChanged()
  );
  readonly movedNodesExtent$ = this.movedNodes$.pipe(
    map((movedNodes) =>
      movedNodes.length
        ? {
            x0: minBy(movedNodes, 'x0').x0,
            x1: maxBy(movedNodes, 'x1').x1,
            y0: minBy(movedNodes, 'y0').y0,
            y1: maxBy(movedNodes, 'y1').y1,
          }
        : null
    )
  );
  readonly viewPort$ = new ReplaySubject<{ x0: number; y0: number; width: number; height: number }>(
    1
  );
  readonly viewBox$ = combineLatest([this.viewPort$, this.movedNodesExtent$]).pipe(
    map(([viewPort, movedNodesExtent]) => {
      let { width, height } = viewPort;
      let x0 = 0;
      let y0 = 0;
      if (movedNodesExtent.x1 > width) {
        width = movedNodesExtent.x1;
      }
      if (movedNodesExtent.y1 > height) {
        height = movedNodesExtent.y1;
      }
      if (movedNodesExtent.x0 < 0) {
        width -= movedNodesExtent.x0;
        x0 -= movedNodesExtent.x0;
      }
      if (movedNodesExtent.y0 < 0) {
        height -= movedNodesExtent.y0;
        y0 -= movedNodesExtent.y0;
      }
      return { width, height, x0, y0 };
    })
  );

  modified(element, data) {
    this.movedNode$.next(data);
  }

  reset() {
    this.reset$.next(false);
  }
}
