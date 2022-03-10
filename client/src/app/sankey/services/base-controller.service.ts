import { Injectable, Injector } from '@angular/core';

import { Observable, of, iif, merge as rxjs_merge } from 'rxjs';
import { map, tap, switchMap, first, distinctUntilChanged, filter } from 'rxjs/operators';
import { merge, isNil, omitBy, has, pick, isEqual } from 'lodash-es';

import { isNotEmpty } from 'app/shared/utils';
import {
  ValueGenerator,
  NODE_VALUE_GENERATOR,
  LINK_VALUE_GENERATOR,
  LINK_PROPERTY_GENERATORS,
  NetworkTraceData,
  SankeyView,
  MultiValueAccessor
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { debug } from 'app/shared/rxjs/debug';

import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { SankeyBaseState, SankeyBaseOptions, SankeyNodeHeight } from '../base-views/interfaces';
import { customisedMultiValueAccessorId, customisedMultiValueAccessor } from './controller.service';
import { StateControlAbstractService } from '../abstract/state-control.service';
import { unifiedSingularAccessor } from '../utils/rxjs';
import { getBaseState } from '../utils/stateLevels';
import { ErrorMessages, NotImplemented } from '../error';

export type DefaultBaseControllerService = BaseControllerService<SankeyBaseOptions, SankeyBaseState>;

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class BaseControllerService<Options extends SankeyBaseOptions, State extends SankeyBaseState>
  extends StateControlAbstractService<Options, State> implements ServiceOnInit {

  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super();
  }

  fontSizeScale$: Observable<unknown>;

  nodeHeight$: Observable<SankeyNodeHeight>;
  networkTraceData$: Observable<NetworkTraceData>;
  viewBase;
  nodeValueAccessor$: Observable<ValueGenerator>;
  linkValueAccessor$: Observable<ValueGenerator>;
  predefinedValueAccessor$: Observable<MultiValueAccessor>;

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
        throw new NotImplemented();
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

  resolveView$ = this.common.view$.pipe(
    map(view => isNil(view) ? {} : getBaseState((view as SankeyView).state))
  );

  /**
   * Values from inheriting class are not avaliable when parsing code of base therefore we need to postpone this execution
   */
  onInit() {
    this.nodeValueAccessor$ = unifiedSingularAccessor(
      this.state$,
      'nodeValueAccessorId',
    ).pipe(
      map((nodeValueAccessorId) =>
        nodeValueAccessorId ? (
          this.nodeValueAccessors[nodeValueAccessorId as NODE_VALUE_GENERATOR] ??
          this.nodePropertyAcessor(nodeValueAccessorId)
        ) : (
          this.warningController.warn(ErrorMessages.missingNodeValueAccessor(nodeValueAccessorId)),
            this.nodeValueAccessors[NODE_VALUE_GENERATOR.none]
        )
      )
    );

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
                  this.warningController.warn(ErrorMessages.missingLinkValueAccessor(linkValueAccessorId)),
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

    this.nodeHeight$ = this.stateAccessor('nodeHeight');
  }

  pickPartialAccessors = obj => pick(obj, ['nodeValueAccessorId', 'linkValueAccessorId']);

  resolvePredefinedValueAccessor(defaultValue) {
    // whichever change was more recent
    return rxjs_merge(
      this.delta$.pipe(
        map(({predefinedValueAccessorId = defaultValue}) => predefinedValueAccessorId),
        // here we are sensing change of predefinedValueAccessorId
        // actual accessors are resolved based on options$
        switchMap(predefinedValueAccessorId => this.common.options$.pipe(
          first(),
          map(({predefinedValueAccessors}) => ({
            predefinedValueAccessorId,
            ...this.pickPartialAccessors(predefinedValueAccessors[predefinedValueAccessorId as string])
          }))
        )),
        debug<Partial<State>>('predefinedValueAccessorId change')
      ),
      this.delta$.pipe(
        map(this.pickPartialAccessors),
        distinctUntilChanged(isEqual),
        filter(isNotEmpty),
        // here we are sensing change of (node|link)ValueAccessorId
        // usually we just change one of them so we need to preserve state for the other one
        switchMap(delta => this.state$.pipe(
            first(),
            map(this.pickPartialAccessors),
            map(state => merge(
              {predefinedValueAccessorId: customisedMultiValueAccessorId},
              state,
              delta
            ))
          )
        ),
        debug<Partial<State>>('partialAccessors change')
      )
    ).pipe(
      distinctUntilChanged(isEqual)
    );
  }

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

  nodePropertyAcessor: (k) => ValueGenerator = k => ({
    preprocessing: nodeValues.byProperty(k)
  });

}
