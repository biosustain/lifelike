import { Injectable } from '@angular/core';

import { ReplaySubject, Observable, combineLatest } from 'rxjs';
import { map, tap, share, switchMap, shareReplay } from 'rxjs/operators';
import { merge } from 'lodash-es';

import { SankeyOptions, SankeyState, ViewBase } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyControllerService } from './sankey-controller.service';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class SankeyBaseViewControllerService<Options extends object = object, State extends object = object> {
  constructor(
    readonly c: SankeyControllerService,
    readonly warningController: WarningControllerService
  ) {
    this.defaultState$ = this.c.defaultState$.pipe(
      map(state => merge({}, state, this.baseDefaultState)
      )
    );
    this.state$ = combineLatest([this.c.stateDelta$, this.defaultState$]).pipe(
      map(([delta, defaultState]) => merge({}, defaultState, delta)),
      tap(s => console.log('state update', s)),
      shareReplay()
    );
    this.options$ = this.c.options$ as ReplaySubject<SankeyOptions & Options>;
  }

  networkTraceData$;
  dataToRender$;
  defaultState$: Observable<SankeyState & State>;

  readonly baseDefaultState: State & Partial<SankeyState>;

  readonly viewBase: ViewBase;

  // @ts-ignore
  options$: ReplaySubject<SankeyOptions & Options>;
  // @ts-ignore
  state$: Observable<SankeyState & State>;

  /**
   * Color nodes in gray scale based on group they are relating to.
   */
  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
    throw new Error('Method not implemented.');
  }
}
