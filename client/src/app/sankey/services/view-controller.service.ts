import { Injectable, Injector } from '@angular/core';

import { Observable, combineLatest, of, iif } from 'rxjs';
import { map, tap, shareReplay, filter, switchMap, first } from 'rxjs/operators';
import { merge, omit, isNil, omitBy, has, transform, pick, assign } from 'lodash-es';

import {
  ValueGenerator,
  NODE_VALUE_GENERATOR,
  LINK_VALUE_GENERATOR,
  LINK_PROPERTY_GENERATORS,
  SankeyData,
  SankeyView,
  SankeyNode,
  SankeyLink,
  SankeyNodesOverwrites,
  SankeyLinksOverwrites
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';

import { StateControlAbstractService, unifiedSingularAccessor } from './state-controlling-abstract.service';
import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { SankeyBaseState, SankeyBaseOptions } from '../base-views/interfaces';
import { patchReducer, customisedMultiValueAccessorId, customisedMultiValueAccessor } from './controller.service';
import { LayoutService } from './layout.service';
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
    // readonly layout: LayoutService
  ) {
    // @ts-ignore
    this.baseView = layout.baseView;
    this.common = this.baseView.common;
  }
  layout: LayoutService;
  baseView: BaseControllerService;
  common: ControllerService;

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

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  createView(viewName) {
    return combineLatest([
      this.common.delta$,
      this.baseView.delta$
    ]).pipe(
      map(states => assign({}, ...states)),
      tap(d => console.log('delta', d)),
      switchMap(stateDelta => this.layout.dataToRender$.pipe(
        tap(data => console.log('data', data)),
        map(({nodes, links}) => ({
          state: omit(stateDelta, this.statusOmitProperties),
          base: stateDelta.baseViewName,
          nodes: this.mapToPropertyObject(nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(links, this.linkViewProperties)
        } as SankeyView))
      )),
      switchMap(view => this.common.data$.pipe(
        map(data => ({...data, _views: {...data._views, [viewName]: view}})),
        tap(({_views}) => this.common.viewsUpdate$.next(_views))
      )),
      tap(() => this.common.patchState({viewName}))
    ).toPromise();
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
