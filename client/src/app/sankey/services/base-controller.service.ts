import { Injectable, Injector } from '@angular/core';

import { Observable, combineLatest, of, iif } from 'rxjs';
import { map, tap, shareReplay, switchMap, first } from 'rxjs/operators';
import { merge, isNil, omitBy, has } from 'lodash-es';

import { ValueGenerator, NODE_VALUE_GENERATOR, LINK_VALUE_GENERATOR, LINK_PROPERTY_GENERATORS, SankeyData } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';

import { StateControlAbstractService, unifiedSingularAccessor } from './state-controlling-abstract.service';
import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { SankeyBaseState, SankeyBaseOptions } from '../base-views/interfaces';
import { patchReducer, customisedMultiValueAccessorId, customisedMultiValueAccessor } from './controller.service';

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

  networkTraceData$: Observable<any>;
  viewBase;
  nodeValueAccessor$: Observable<ValueGenerator>;
  linkValueAccessor$: Observable<ValueGenerator>;
  predefinedValueAccessor$;
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

  nodePropertyAcessor: (k) => ValueGenerator = k => ({
    preprocessing: nodeValues.byProperty(k)
  })

  /**
   * Values from inheriting class are not avaliable when parsing code of base therefore we need to postpone this execution
   */
  onInit() {
    super.onInit();
    this.nodeValueAccessor$ = unifiedSingularAccessor(
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
    this.linkValueAccessor$ = unifiedSingularAccessor(
      this.state$, 'linkValueAccessorId'
    ).pipe(
      switchMap((linkValueAccessorId) =>
        iif(
          () => has(this.linkValueAccessors, linkValueAccessorId),
          of(this.linkValueAccessors[linkValueAccessorId as LINK_VALUE_GENERATOR]),
          unifiedSingularAccessor(
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

    this.predefinedValueAccessor$ = unifiedSingularAccessor(
      this.common.options$,
      'predefinedValueAccessors'
    ).pipe(
      switchMap(predefinedValueAccessors => unifiedSingularAccessor(
        this.state$,
        'predefinedValueAccessorId'
      ).pipe(
        map(predefinedValueAccessorId =>
          predefinedValueAccessorId === customisedMultiValueAccessorId ?
            customisedMultiValueAccessor :
            predefinedValueAccessors[predefinedValueAccessorId]
        )))
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
}
