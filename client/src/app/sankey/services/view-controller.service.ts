import { Injectable } from '@angular/core';

import { combineLatest, ReplaySubject, Observable } from 'rxjs';
import { map, tap, switchMap, first } from 'rxjs/operators';
import { omit, transform, assign } from 'lodash-es';

import { ViewBase } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { DefaultLayoutService } from './layout.service';
import { ControllerService } from './controller.service';
import { SankeyNodesOverwrites, SankeyLinksOverwrites, SankeyView } from '../interfaces/view';
import { SankeyNode, SankeyLink } from '../model/sankey-document';
import { EditService } from './edit.service';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class ViewControllerService {
  constructor(
    private common: ControllerService,
    readonly warningController: WarningControllerService,
    protected readonly update: EditService
  ) {
  }

  views$ = this.common.views$;

  activeViewBase$ = this.common.baseViewName$;

  activeViewName$ = this.common.state$.pipe(
    map(({viewName}) => viewName)
  );

  layout$ = new ReplaySubject<DefaultLayoutService>(1);
  baseView$ = this.layout$.pipe(
    map(({baseView}) => baseView)
  );

  readonly statusOmitProperties = ['viewName', 'baseViewInitialState'];

  graph$ = this.layout$.pipe(
    switchMap(layout => layout.graph$)
  );

  graphViewport$ = this.layout$.pipe(
    switchMap(layout => layout.graphViewport$)
  );

  selectView(networkTraceIdx, viewName) {
    return this.common.setState({networkTraceIdx, viewName});
  }

  registerLayout(layout: DefaultLayoutService) {
    this.layout$.next(layout);
  }

  mapToPropertyObject(entities: Array<SankeyNode | SankeyLink>): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity.id] = entity.viewProperties;
    }, {});
  }

  openBaseView(baseViewName: ViewBase): Observable<any> {
    return this.common.setState({
      networkTraceIdx: null,
      baseViewName
    });
  }

  createView(viewName: string) {
    return combineLatest([
      // todo
      // new implementation allows delta but to reduce changes do it same as before refractoring
      // this.common.delta$,
      // this.baseView$.pipe(switchMap(baseView => baseView.delta$))
      this.common.state$,
      this.baseView$.pipe(switchMap(baseView => baseView.state$))
    ]).pipe(
      first(),
      map(states => assign({}, ...states)),
      map(stateDelta => omit(stateDelta, this.statusOmitProperties)),
      switchMap(state => this.graph$.pipe(
        first(),
        map(({nodes, links}) => ({
          state,
          nodes: this.mapToPropertyObject(nodes as any),
          links: this.mapToPropertyObject(links as any)
        }))
      )),
      switchMap(partialView => this.graphViewport$.pipe(
        first(),
        map(({width, height}) => ({
          ...partialView,
          size: {width, height}
        } as SankeyView))
      )),
      switchMap(view => this.common.networkTrace$.pipe(
        first(),
        tap(networkTrace => networkTrace.addView(viewName, view))
      )),
      tap(() => this.common.viewsUpdate$.next()),
      switchMap(() => this.common.setState({viewName}))
    );
  }

  deleteView(viewName) {
    return this.common.networkTrace$.pipe(
      first(),
      tap(networkTrace => networkTrace.deleteView(viewName)),
      tap(views => this.common.viewsUpdate$.next(viewName)),
      // If the deleted view is the current view, switch from it
      switchMap(() => this.common.reduceState(
        state =>
          state.viewName === viewName ? omit(state, 'viewName') : state
      ))
    );
  }
}
