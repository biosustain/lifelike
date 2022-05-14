import { Injectable, Injector, OnDestroy } from '@angular/core';

import { Observable, of, iif, merge as rxjs_merge, Subject, combineLatest } from 'rxjs';
import { map, tap, switchMap, first, distinctUntilChanged } from 'rxjs/operators';
import { merge, isNil, omitBy, has, pick, isEqual, isEmpty, omit } from 'lodash-es';

import { NetworkTraceData, TypeContext } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { debug } from 'app/shared/rxjs/debug';

import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { SankeyNodeHeight } from '../base-views/interfaces';
import { StateControlAbstractService } from '../abstract/state-control.service';
import { unifiedSingularAccessor } from '../utils/rxjs';
import { getBaseState } from '../utils/stateLevels';
import { ErrorMessages } from '../constants/error';
import { NotImplemented } from '../utils/error';
import {
  ValueGenerator,
  MultiValueAccessor,
  LINK_VALUE_GENERATOR,
  LINK_PROPERTY_GENERATORS,
  NODE_VALUE_GENERATOR
} from '../interfaces/valueAccessors';
import { SankeyView } from '../interfaces/view';
import { EditService } from './edit.service';

export type DefaultBaseControllerService = BaseControllerService<TypeContext>;

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class BaseControllerService<Base extends TypeContext>
  extends StateControlAbstractService<Base['options'], Base['state']> implements ServiceOnInit, OnDestroy {

  hasPendingChanges$ = combineLatest([
    this.update.edited$,
    this.common.view$.pipe(
      switchMap(view =>
        iif(
          () => isNil(view),
          of(false),
          this.delta$.pipe(
            switchMap(baseViewDelta =>
              iif(
                () => isEmpty(baseViewDelta),
                this.common.delta$.pipe(
                  map(commonDelta => omit(commonDelta, ['viewName', 'networkTraceIdx'])),
                  map(commonDelta => !isEmpty(commonDelta))
                ),
                of(true)
              )
            )
          )
        )
      ),
    )
  ]).pipe(
    map(editFlags => editFlags.some(f => f)),
  );

  destroy$ = new Subject<void>();

  fontSizeScale$: Observable<unknown>;

  nodeHeight$: Observable<SankeyNodeHeight>;
  networkTraceData$: Observable<NetworkTraceData<Base>>;
  viewBase;
  nodeValueAccessor$: Observable<ValueGenerator<Base>>;
  linkValueAccessor$: Observable<ValueGenerator<Base>>;
  predefinedValueAccessor$: Observable<MultiValueAccessor>;

  // @ts-ignore
  readonly linkValueAccessors: {
    [generatorId in LINK_VALUE_GENERATOR]: ValueGenerator<Base>
  } = Object.freeze({
    [LINK_VALUE_GENERATOR.fixedValue0]: {
      preprocessing: linkValues.fixedValue(0)
    },
    [LINK_VALUE_GENERATOR.fixedValue1]: {
      preprocessing: linkValues.fixedValue(1)
    },
    // [LINK_VALUE_GENERATOR.fraction_of_fixed_nodevalue]: {
    //   requires: ({node}) => node.fixedValue,
    //   preprocessing: linkValues.fractionOfFixedNodeValue
    // },
    // defined per base view - different implementation
    [LINK_VALUE_GENERATOR.input_count]: {
      preprocessing: () => {
        throw new NotImplemented();
      }
    }
  });

  linkPropertyAcessors: {
    [generatorId in LINK_PROPERTY_GENERATORS]: (k) => ValueGenerator<Base>
  } = {
    [LINK_PROPERTY_GENERATORS.byProperty]: k => ({
      // @ts-ignore
      preprocessing: linkValues.byProperty(k),
      postprocessing: ({links}) => {
        links.forEach(l => {
          l.value /= (l.adjacentDivider || 1);
          // take max for layer calculation
        });
        return {
          _sets: {
            link: {
              value: true
            }
          }
        };
      }
    }),
    [LINK_PROPERTY_GENERATORS.byArrayProperty]: k => ({
      // @ts-ignore
      preprocessing: linkValues.byArrayProperty(k),
      postprocessing: ({links}) => {
        links.forEach(l => {
          l.multipleValues = l.multipleValues.map(d => d / (l.adjacentDivider || 1)) as [number, number];
          // take max for layer calculation
        });
        return {
          _sets: {
            link: {
              multipleValues: true
            }
          }
        };
      }
    }),
  };

  nodeValueAccessors: {
    [generatorId in NODE_VALUE_GENERATOR]: ValueGenerator<Base>
  } = {
    [NODE_VALUE_GENERATOR.none]: {
      preprocessing: nodeValues.noneNodeValue
    },
    [NODE_VALUE_GENERATOR.fixedValue1]: {
      // @ts-ignore
      preprocessing: nodeValues.fixedValue(1)
    }
  };

  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector,
    protected readonly update: EditService
  ) {
    super();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }

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
        debug<Partial<Base['state']>>('predefinedValueAccessorId change')
      ),
      // this.delta$.pipe(
      //   map(this.pickPartialAccessors),
      //   distinctUntilChanged(isEqual),
      //   filter(isNotEmpty),
      //   // here we are sensing change of (node|link)ValueAccessorId
      //   // usually we just change one of them so we need to preserve state for the other one
      //   switchMap(delta => this.state$.pipe(
      //       first(),
      //       map(this.pickPartialAccessors),
      //       map(state => merge(
      //         {predefinedValueAccessorId: customisedMultiValueAccessorId},
      //         state,
      //         delta
      //       ))
      //     )
      //   ),
      //   debug<Partial<Base['state']>>('partialAccessors change')
      // )
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
        this.delta$.next(stateDelta as Partial<Base['state']>);
      })
    );
  }

  nodePropertyAcessor: (k) => ValueGenerator<Base> = k => ({
    // @ts-ignore
    preprocessing: nodeValues.byProperty(k)
  })
}
