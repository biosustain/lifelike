import { Injectable, Injector } from '@angular/core';

import { Observable, combineLatest, of, iif } from 'rxjs';
import { map, tap, shareReplay, filter, switchMap, first } from 'rxjs/operators';
import { merge, omit, isNil, omitBy, has } from 'lodash-es';

import { ValueGenerator, NODE_VALUE_GENERATOR, LINK_VALUE_GENERATOR, LINK_PROPERTY_GENERATORS, SankeyData } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import {
  ControllerService,
  customisedMultiValueAccessorId,
  customisedMultiValueAccessor,
  patchReducer
} from './sankey-controller.service';
import { StateControlAbstractService } from './state-controlling-abstract.service';
import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { SankeyBaseState, SankeyBaseOptions } from '../base-views/interfaces';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class BaseControllerService<Options extends SankeyBaseOptions = SankeyBaseOptions,
  State extends SankeyBaseState = SankeyBaseState> extends StateControlAbstractService<Options, State> {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super();
  }

  networkTraceData$;
  viewBase;
  nodeValueAccessor$: Observable<ValueGenerator>;
  linkValueAccessor$: Observable<ValueGenerator>;
  predefinedValueAccessor$;
  dataToRender$: Observable<SankeyData>;
  graphInputState$: Observable<any>;

  mergedState$;

  readonly linkValueAccessors: {
    [generatorId in LINK_VALUE_GENERATOR]: ValueGenerator
  } = Object.freeze({
    [LINK_VALUE_GENERATOR.fixedValue0]: {
      preprocessing: linkValues.fixedValue(0)
    },
    [LINK_VALUE_GENERATOR.fixedValue1]: {
      preprocessing: linkValues.fixedValue(1)
    },
    [LINK_VALUE_GENERATOR.fraction_of_fixed_node_value]: {
      requires: ({node}) => node.fixedValue,
      preprocessing: linkValues.fractionOfFixedNodeValue
    },
    // defined per base view - different implementation
    [LINK_VALUE_GENERATOR.input_count]: {
      preprocessing: () => {
        throw new Error('Not implemented');
      }
    }
  });

  linkPropertyAcessors: {
    [generatorId in LINK_PROPERTY_GENERATORS]: (k) => ValueGenerator
  } = {
    [LINK_PROPERTY_GENERATORS.byProperty]: k => ({
      preprocessing: linkValues.byProperty(k),
      postprocessing: ({links}) => {
        links.forEach(l => {
          l._value /= (l._adjacent_divider || 1);
          // take max for layer calculation
        });
        return {
          _sets: {
            link: {
              _value: true
            }
          }
        };
      }
    }),
    [LINK_PROPERTY_GENERATORS.byArrayProperty]: k => ({
      preprocessing: linkValues.byArrayProperty(k),
      postprocessing: ({links}) => {
        links.forEach(l => {
          l._multiple_values = l._multiple_values.map(d => d / (l._adjacent_divider || 1)) as [number, number];
          // take max for layer calculation
        });
        return {
          _sets: {
            link: {
              _multiple_values: true
            }
          }
        };
      }
    }),
  };

  nodeValueAccessors: {
    [generatorId in NODE_VALUE_GENERATOR]: ValueGenerator
  } = {
    [NODE_VALUE_GENERATOR.none]: {
      preprocessing: nodeValues.noneNodeValue
    },
    [NODE_VALUE_GENERATOR.fixedValue1]: {
      preprocessing: nodeValues.fixedValue(1)
    }
  };

  nodePropertyAcessor: (k) => ValueGenerator = k => ({
    preprocessing: nodeValues.byProperty(k)
  })


  predefinedValueAccessorReducer({predefinedValueAccessors = {}}, {predefinedValueAccessorId}) {
    if (!isNil(predefinedValueAccessorId)) {
      const {
        linkValueAccessorId,
        nodeValueAccessorId
      } = predefinedValueAccessors[predefinedValueAccessorId];
      return {
        linkValueAccessorId,
        nodeValueAccessorId,
        predefinedValueAccessorId,
      };
    } else {
      return {};
    }
  }

  defaultPredefinedValueAccessorReducer({networkTraces = {}, predefinedValueAccessors = {}}, {networkTraceIdx}) {
    const predefinedValueAccessorId = networkTraces[networkTraceIdx]?.default_sizing;
    return this.predefinedValueAccessorReducer({predefinedValueAccessors}, {predefinedValueAccessorId});
  }

  // @ts-ignore
  patchState(statePatch) {
    return this.delta$.pipe(
      first(),
      map(currentStateDelta =>
        // ommit empty values so they can be overridden by defaultState
        omitBy(
          merge(
            {},
            currentStateDelta,
            statePatch,
          ),
          isNil
        )
      ),
      patchReducer(statePatch, (state, patch) => {
        if (!isNil(patch.networkTraceIdx)) {
          return this.options$.pipe(
            first(),
            map(options => {
              return {
                ...state,
                // todo
                // ...this.defaultPredefinedValueAccessorReducer(options, patch.networkTraceIdx)
              };
            })
          );
        }
      }),
      tap(stateDelta => {
        this.delta$.next(stateDelta as Partial<State>);
      })
    );
  }

  selectPredefinedValueAccessor(predefinedValueAccessorId: string) {
    return this.common.options$.pipe(
      switchMap(options => this.patchState(
        this.predefinedValueAccessorReducer(options, {predefinedValueAccessorId})
      ))
    );
  }

  /**
   * Values from inheriting class are not avaliable when parsing code of base therefore we need to postpone this execution
   */
  onInit() {
    super.onInit();
    this.nodeValueAccessor$ = this.unifiedSingularAccessor(
      this.state$,
      'nodeValueAccessorId',
    ).pipe(
      map((nodeValueAccessorId) =>
        nodeValueAccessorId ? (
          this.nodeValueAccessors[nodeValueAccessorId as NODE_VALUE_GENERATOR] ??
          this.nodePropertyAcessor(nodeValueAccessorId)
        ) : (
          this.warningController.warn(`Node values accessor ${nodeValueAccessorId} could not be found`),
            this.nodeValueAccessors[NODE_VALUE_GENERATOR.none]
        )
      )
    );

    // noinspection JSVoidFunctionReturnValueUsed
    this.linkValueAccessor$ = this.unifiedSingularAccessor(
      this.state$, 'linkValueAccessorId'
    ).pipe(
      switchMap((linkValueAccessorId) =>
        iif(
          () => has(this.linkValueAccessors, linkValueAccessorId),
          of(this.linkValueAccessors[linkValueAccessorId as LINK_VALUE_GENERATOR]),
          this.unifiedSingularAccessor(
            this.common.options$,
            'linkValueAccessors'
          ).pipe(
            map(linkValueAccessors =>
                this.linkPropertyAcessors[linkValueAccessors[linkValueAccessorId]?.type]?.(linkValueAccessorId) ?? (
                  this.warningController.warn(`Link values accessor ${linkValueAccessorId} could not be found`),
                    this.linkValueAccessors[LINK_VALUE_GENERATOR.fixedValue0]
                )
            )
          )
        )
      ));

    this.predefinedValueAccessor$ = this.unifiedSingularAccessor(
      this.common.options$,
      'predefinedValueAccessors'
    ).pipe(
      switchMap(predefinedValueAccessors => this.unifiedSingularAccessor(
        this.state$,
        'predefinedValueAccessorId'
      ).pipe(
        map(predefinedValueAccessorId =>
          predefinedValueAccessorId === customisedMultiValueAccessorId ?
            customisedMultiValueAccessor :
            predefinedValueAccessors[predefinedValueAccessorId]
        )))
    );

    this.dataToRender$ = this.networkTraceData$.pipe(
      switchMap(networkTraceData => this.linkGraph(networkTraceData))
    );

    this.mergedState$ = combineLatest([
      this.common.state$,
      this.state$
    ]).pipe(
      map(([state, baseState]) => ({
        ...state,
        baseState
      })),
      shareReplay(1)
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
      this.common.prescaler$.pipe(tap(d => console.log('linkGraph prescaler', d)))
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
