import { Injectable } from '@angular/core';

import { combineLatest, ReplaySubject, Observable } from 'rxjs';
import { map, tap, switchMap, filter } from 'rxjs/operators';
import { omit, transform, pick, assign } from 'lodash-es';

import {
  SankeyView,
  SankeyNode,
  SankeyLink,
  SankeyNodesOverwrites,
  SankeyLinksOverwrites,
  ViewBase,
  SankeyURLLoadParams
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { LayoutService } from './layout.service';
import { ControllerService } from './controller.service';
import { BaseControllerService } from './base-controller.service';

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

  activeViewBase$ = this.common.state$.pipe(
    map(({baseViewName}) => baseViewName)
  );

  activeViewName$ = this.common.state$.pipe(
    map(({viewName}) => viewName)
  );

  activeView$ = this.common.views$.pipe(
    switchMap(views => this.common.state$.pipe(
      map(({viewName}) => views[viewName])
    ))
  );

  views$ = this.common.views$;

  layout$ = new ReplaySubject<LayoutService>(1);
  baseView$ = new ReplaySubject<BaseControllerService>(1);

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
  readonly statusOmitProperties = ['viewName', 'baseViewName'];

  dataToRender$ = this.layout$.pipe(
    switchMap(layout => layout.dataToRender$)
  );

  applyPropertyObject(
    propertyObject: SankeyNodesOverwrites | SankeyLinksOverwrites,
    entities: Array<SankeyNode | SankeyLink>
  ): void {
    // for faster lookup
    const entityById = new Map(entities.map((d, i) => [String(d._id), d]));
    Object.entries(propertyObject).map(([id, properties]) => {
      const entity = entityById.get(id);
      if (entity) {
        Object.assign(entity, properties);
      } else {
        this.warningController.warn(`No entity found for id ${id}`);
      }
    });
  }

  selectView(viewName) {
    return this.views$.pipe(
      map(views => views[viewName]),
      filter(view => !!view),
      switchMap(view =>
        this.common.patchState({
          viewName,
          ...view.state
        }).pipe(
          switchMap(stateDelta => this.common.partialNetworkTraceData$.pipe(
            map((networkTraceData: { links: SankeyLink[], nodes: SankeyNode[] }) => {
              (networkTraceData as any)._precomputedLayout = true;
              this.applyPropertyObject(view.nodes, networkTraceData.nodes);
              this.applyPropertyObject(view.links, networkTraceData.links);
              // @ts-ignore
              // todo
              // const layout = new LayoutService(this);
              // layout.computeNodeLinks(networkTraceData);
              return networkTraceData;
            })
          ))
        )
      )
    ).toPromise();
  }

  registerLayout(layout: LayoutService) {
    this.layout$.next(layout);
  }

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  openBaseView(baseViewName: ViewBase): Observable<any> {
    return this.common.patchState({
      baseViewName
    });
  }

  createView(viewName) {
    return combineLatest([
      this.common.delta$,
      this.baseView$.pipe(switchMap(baseView => baseView.delta$))
    ]).pipe(
      map(states => assign({}, ...states)),
      map(stateDelta => omit(stateDelta, this.statusOmitProperties)),
      switchMap(state => this.activeViewBase$.pipe(
        map(baseViewName => ({
          state,
          base: baseViewName
        })),
      )),
      switchMap(partialView => this.dataToRender$.pipe(
        map(({nodes, links}) => ({
          ...partialView,
          nodes: this.mapToPropertyObject(nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(links, this.linkViewProperties)
        } as SankeyView))
      )),
      switchMap(view => this.common.data$.pipe(
        map(data => ({...data, _views: {...data._views, [viewName]: view}})),
        tap(({_views}) => this.common.viewsUpdate$.next(_views))
      )),
      tap(() => this.common.patchState({viewName}))
    );
  }

  deleteView(viewName) {
    return this.common.views$.pipe(
      map(views => omit(views, viewName)),
      switchMap(views => this.common.views$.pipe(
        tap(() => this.common.viewsUpdate$.next(views))
      )),
      // If the deleted view is the current view, switch from it
      switchMap(() => this.common.patchState(
        {viewName: null},
        (delta, patch) =>
          delta.viewName === viewName && {
            ...delta,
            viewName: null
          }
      )),
    ).toPromise();
  }
}
