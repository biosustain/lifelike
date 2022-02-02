import { Injectable, Injector } from '@angular/core';

import { Observable, combineLatest } from 'rxjs';
import { map, tap, shareReplay, filter, switchMap } from 'rxjs/operators';
import { merge, omit } from 'lodash-es';

import { SankeyOptions, SankeyState, ValueGenerator, NODE_VALUE_GENERATOR } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyControllerService, customisedMultiValueAccessorId, customisedMultiValueAccessor } from './sankey-controller.service';
import { StateControlAbstractService } from './state-controlling-abstract.service';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class SankeyBaseViewControllerService<Options extends object = object, State extends object = object>
  extends StateControlAbstractService<Options, State> {
  constructor(
    readonly c: SankeyControllerService,
    readonly warningController: WarningControllerService
  ) {
    super();
  }

  networkTraceData$;
  baseDefaultState$;
  baseDefaultOptions;
  viewBase;
  options$: Observable<SankeyOptions & Options>;
  defaultState$: Observable<SankeyState & State>;
  state$: Observable<SankeyState & State>;
  nodeValueAccessor$: Observable<ValueGenerator>;
  linkValueAccessor$: Observable<ValueGenerator>;
  predefinedValueAccessor$;
  dataToRender$;
  graphInputState$: Observable<any>;

  /**
   * Values from inheriting class are not avaliable when parsing code of base therefore we need to postpone this execution
   */
  initCommonObservables() {
    this.options$ = this.c.options$.pipe(
      map(options => merge({}, options, this.baseDefaultOptions)),
    );

    // @ts-ignore
    this.defaultState$ = combineLatest([
      this.c.defaultState$,
      this.baseDefaultState$
    ]).pipe(
      map(states => merge({}, ...states))
    );

    this.state$ = combineLatest([this.c.stateDelta$, this.defaultState$]).pipe(
      map(([delta, defaultState]) => merge({}, defaultState, delta)),
      tap(s => console.warn('state update', s)),
      shareReplay(1)
    );

    this.nodeValueAccessor$ = this.optionStateMultiAccessor<ValueGenerator>(
      ['nodeValueGenerators', 'nodeValueAccessors'] as any,
      ['nodeValueAccessorId'],
      ({nodeValueGenerators, nodeValueAccessors}, {nodeValueAccessorId}) =>
        nodeValueGenerators[nodeValueAccessorId] ??
        nodeValueAccessors[nodeValueAccessorId] ??
        (
          this.warningController.warn(`Node values accessor ${nodeValueAccessorId} could not be found`),
            nodeValueGenerators[NODE_VALUE_GENERATOR.none]
        )
    );

    // noinspection JSVoidFunctionReturnValueUsed
    this.linkValueAccessor$ = this.optionStateMultiAccessor<ValueGenerator>(
      ['linkValueGenerators', 'linkValueAccessors'] as any,
      ['linkValueAccessorId'],
      ({linkValueGenerators, linkValueAccessors}, {linkValueAccessorId}) =>
        linkValueGenerators[linkValueAccessorId] ??
        linkValueAccessors[linkValueAccessorId] ??
        (
          this.warningController.warn(`Link values accessor ${linkValueAccessorId} could not be found`),
            linkValueGenerators[NODE_VALUE_GENERATOR.none]
        )
    );

    this.predefinedValueAccessor$ = this.optionStateAccessor(
      'predefinedValueAccessors' as any,
      'predefinedValueAccessorId' as any,
      (predefinedValueAccessors, predefinedValueAccessorId) =>
        predefinedValueAccessorId === customisedMultiValueAccessorId ?
          customisedMultiValueAccessor :
          predefinedValueAccessors[predefinedValueAccessorId]
    );


    this.dataToRender$ = this.networkTraceData$.pipe(
      switchMap(networkTraceData => this.linkGraph(networkTraceData))
    );
  }

  /**
   * Color nodes in gray scale based on group they are relating to.
   */
  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
    throw new Error('Method not implemented.');
  }

  linkGraph(data) {
    return combineLatest([
      this.nodeValueAccessor$.pipe(tap(d => console.log('linkGraph nodeValueAccessor', d))),
      this.linkValueAccessor$.pipe(tap(d => console.log('linkGraph linkValueAccessor', d))),
      this.c.prescaler$.pipe(tap(d => console.log('linkGraph prescaler', d)))
    ]).pipe(
      tap(console.log),
      filter(params => params.every(param => !!param)),
      map(([nodeValueAccessor, linkValueAccessor, prescaler]) => {

        const preprocessedNodes = nodeValueAccessor.preprocessing.call(this, data) ?? {};
        const preprocessedLinks = linkValueAccessor.preprocessing.call(this, data) ?? {};

        Object.assign(
          data,
          preprocessedLinks,
          preprocessedNodes,
          merge(
            omit(preprocessedLinks, ['nodes', 'links']),
            omit(preprocessedNodes, ['nodes', 'links'])
          )
        );

        let minValue = data.nodes.reduce((m, n) => {
          if (n._fixedValue !== undefined) {
            n._fixedValue = prescaler.fn(n._fixedValue);
            return Math.min(m, n._fixedValue);
          }
          return m;
        }, 0);
        minValue = data.links.reduce((m, l) => {
          l._value = prescaler.fn(l._value);
          if (l._multiple_values) {
            l._multiple_values = l._multiple_values.map(prescaler.fn) as [number, number];
            return Math.min(m, ...l._multiple_values);
          }
          return Math.min(m, l._value);
        }, minValue);

        if (nodeValueAccessor.postprocessing) {
          Object.assign(data, nodeValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (linkValueAccessor.postprocessing) {
          Object.assign(data, linkValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (minValue < 0) {
          data.nodes.forEach(n => {
            if (n._fixedValue !== undefined) {
              n._fixedValue = n._fixedValue - minValue;
            }
          });
          data.links.forEach(l => {
            l._value = l._value - minValue;
            if (l._multiple_values) {
              l._multiple_values = l._multiple_values.map(v => v - minValue) as [number, number];
            }
          });
        }

        return data;
      })
    );
  }
}
