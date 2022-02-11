import { Injectable } from '@angular/core';

import { combineLatest, ReplaySubject, Observable } from 'rxjs';
import { map, tap, switchMap, filter, first } from 'rxjs/operators';
import { omit, transform, pick, assign } from 'lodash-es';

import { SankeyView, SankeyNodesOverwrites, SankeyLinksOverwrites, ViewBase, SankeyNode, SankeyLink } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { LayoutService, DefaultLayoutService } from './layout.service';
import { ControllerService } from './controller.service';
import { BaseControllerService, DefaultBaseControllerService } from './base-controller.service';
import { getCommonState, getBaseState } from '../stateLevels';

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
    readonly warningController: WarningControllerService
  ) {
  }

  views$ = this.common.views$;

  activeViewBase$ = this.common.state$.pipe(
    map(({baseViewName}) => baseViewName)
  );

  activeViewName$ = this.common.state$.pipe(
    map(({viewName}) => viewName)
  );

  layout$ = new ReplaySubject<DefaultLayoutService>(1);
  baseView$ = new ReplaySubject<DefaultBaseControllerService>(1);

  readonly nodeViewProperties: Array<keyof SankeyNode> = [
    '_layer',
    '_fixedValue',
    '_value',
    '_depth',
    '_height',
    '_x0',
    '_x1',
    '_y0',
    '_y1',
    '_order'
  ];
  readonly linkViewProperties: Array<keyof SankeyLink> = [
    '_value',
    '_multiple_values',
    '_y0',
    '_y1',
    '_circular',
    '_width',
    '_order',
    '_adjacent_divider',
    '_id'
  ];
  readonly statusOmitProperties = ['viewName', 'baseViewName', 'baseViewInitialState'];

  dataToRender$ = this.layout$.pipe(
    switchMap(layout => layout.dataToRender$)
  );


  selectView(viewName) {
    return this.common.views$.pipe(
      first(),
      map(views => views[viewName]),
      filter(view => !!view),
      tap(view =>
        this.common.delta$.next({
          viewName,
          baseViewName: view.base,
          ...getCommonState(view.state)
        })
      ),
      switchMap(view =>
        this.baseView$.pipe(
          map(baseView =>
            baseView.delta$.next(getBaseState(view.state))
          )
        )
      )
    );
  }

  registerLayout(layout: DefaultLayoutService) {
    this.layout$.next(layout);
  }

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  openBaseView(baseViewName: ViewBase): Observable<any> {
    return this.common.patchState({
      baseViewName,
      viewName: null
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
      switchMap(state => this.activeViewBase$.pipe(
        first(),
        map(base => ({
          state,
          viewName,
          base
        })),
      )),
      switchMap(partialView => this.dataToRender$.pipe(
        first(),
        map(({nodes, links}) => ({
          ...partialView,
          size: {
            // todo
            width: 0,
            height: 0
          },
          nodes: this.mapToPropertyObject(nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(links, this.linkViewProperties)
        } as SankeyView))
      )),
      switchMap(view => this.views$.pipe(
        first(),
        tap(views => this.common.viewsUpdate$.next({...views, [viewName]: view}))
      )),
      switchMap(_views => this.common.data$.pipe(
        first(),
        map(data => ({...data, _views}))
      )),
      tap(() => this.common.patchState({viewName}))
    );
  }

  deleteView(viewName) {
    return this.common.views$.pipe(
      first(),
      map(views => omit(views, viewName)),
      tap(views => this.common.viewsUpdate$.next(views)),
      // If the deleted view is the current view, switch from it
      switchMap(() => this.common.patchState(
        {viewName: null},
        (delta, patch) =>
          delta.viewName === viewName && {
            ...delta,
            viewName: null
          }
      )),
    );
  }
}
