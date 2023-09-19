import { Injectable, OnDestroy } from '@angular/core';

import { of, Subject, iif, ReplaySubject, Observable, EMPTY, defer, from } from 'rxjs';
import { pick as _pick, get as _get, omit as _omit, transform as _transform } from 'lodash-es';
import {
  merge as _merge,
  mergeAll as _mergeAll,
  clone as _clone,
  flatMap as _flatMap,
  isEqual as _isEqual,
  uniq as _uniq,
  isNil as _isNil,
  keys as _keys,
  isEmpty as _isEmpty,
  flow as _flow,
  map as _map,
} from 'lodash/fp';
import {
  switchMap,
  map,
  first,
  shareReplay,
  distinctUntilChanged,
  startWith,
  pairwise,
  tap,
  takeUntil,
  filter,
} from 'rxjs/operators';
import { max } from 'd3';

import Graph from 'app/shared/providers/graph-type/interfaces';
import {
  SankeyState,
  SankeyFileOptions,
  SankeyStaticOptions,
  ViewBase,
  SankeyId,
  SankeyOptions,
  SankeyTraceNetwork,
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { debug } from 'app/shared/rxjs/debug';
import { $freezeInDev } from 'app/shared/rxjs/development';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { TrackingService } from 'app/shared/services/tracking.service';
import { TRACKING_ACTIONS, TRACKING_CATEGORIES } from 'app/shared/schemas/tracking';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { isNotEmpty } from 'app/shared/utils';

import { prescalers } from '../constants/prescalers';
import { aligns } from '../constants/aligns';
import { isPositiveNumber, indexByProperty } from '../utils';
import { LayoutService } from './layout.service';
import { unifiedSingularAccessor } from '../utils/rxjs';
import { StateControlAbstractService } from '../abstract/state-control.service';
import { getCommonState } from '../utils/stateLevels';
import { ErrorMessages } from '../constants/error';
import { PRESCALER_ID, Prescaler } from '../interfaces/prescalers';
import {
  PREDEFINED_VALUE,
  LINK_VALUE_GENERATOR,
  NODE_VALUE_GENERATOR,
  LINK_PROPERTY_GENERATORS,
} from '../interfaces/valueAccessors';
import { SankeyViews } from '../interfaces/view';
import { SankeyPathReportEntity } from '../interfaces/report';
import { Align, ALIGN_ID } from '../interfaces/align';
import { SankeyDocument, TraceNetwork, SankeyNode, View } from '../model/sankey-document';

/**
 * Reducer pipe
 * given state and patch, can return new state or modify it in place
 */
export function patchReducer(patch, callback) {
  return switchMap((stateDelta) => callback(stateDelta, patch) ?? of(stateDelta));
}

interface Utils<Nodes> {
  nodeById;
}

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class ControllerService
  extends StateControlAbstractService<SankeyOptions, SankeyState>
  implements OnDestroy
{
  constructor(
    readonly warningController: WarningControllerService,
    private readonly messageDialog: MessageDialog,
    private readonly moduleContext: ModuleContext,
    private readonly tracking: TrackingService
  ) {
    super();

    this.delta$
      .pipe(
        takeUntil(this.destroyed$),
        map(({ networkTraceIdx, viewName }) => ({ networkTraceIdx, viewName })),
        filter(isNotEmpty),
        distinctUntilChanged(_isEqual),
        switchMap((delta) =>
          from(this.moduleContext.appLink).pipe(map((href) => ({ ...delta, href })))
        )
      )
      .subscribe(({ networkTraceIdx, viewName, href }) => {
        let label = `networkTraceIdx:\t${networkTraceIdx}`;
        if (viewName) {
          label += `\nviewName:\t${viewName}`;
        }
        this.tracking.register({
          category: TRACKING_CATEGORIES.sankey,
          action: TRACKING_ACTIONS.navigateWithin,
          label,
          url: href,
        });
      });
  }

  readonly destroyed$ = new Subject();

  readonly delta$ = new ReplaySubject<Partial<SankeyState>>(1);
  readonly _data$ = new ReplaySubject<Graph.File>(1);

  readonly state$ = this.delta$
    .pipe(
      map((delta) => _mergeAll([{}, { networkTraceIdx: 0 }, delta])),
      switchMap((delta) =>
        iif(
          () => !_isNil(delta.viewName) && !_isNil(delta.networkTraceIdx),
          this.data$.pipe(
            map(({ graph: { traceNetworks } }) => traceNetworks[delta.networkTraceIdx]),
            map(({ views }) => views[delta.viewName]),
            switchMap((view) =>
              iif(
                () => _isNil(view),
                defer(
                  () =>
                    this.messageDialog
                      .display({
                        title: 'Trace network view does not exist',
                        message: `Trace network ${delta.networkTraceIdx} does not contain a view named '${delta.viewName}'.`,
                        additionalMsgs: ['View might have been deleted or renamed.'],
                        type: MessageType.Error,
                      })
                      .then(
                        () => EMPTY,
                        () => EMPTY
                      ) // cancel current update
                      .finally(() => this.patchState({ viewName: null }).toPromise()) // init corrected update
                ),
                defer(() => of(getCommonState((view as View).state)))
              )
            ),
            map((state) => _mergeAll([{}, state, delta]))
          ),
          of(delta)
        )
      ),
      map((delta) =>
        _mergeAll([
          {},
          {
            networkTraceIdx: 0,
            normalizeLinks: false,
            prescalerId: PRESCALER_ID.none,
            labelEllipsis: {
              enabled: true,
              value: LayoutService.labelEllipsis,
            },
            fontSizeScale: 1.0,
            shortestPathPlusN: 0,
          },
          delta,
        ])
      ),
      switchMap((delta: Partial<SankeyState>) =>
        iif(
          () => !_isNil(delta.networkTraceIdx),
          this.data$.pipe(
            map(({ graph: { traceNetworks } }) => traceNetworks[delta.networkTraceIdx]),
            map(({ sources, targets, defaults }) => ({
              alignId: sources.length > targets.length ? ALIGN_ID.right : ALIGN_ID.left,
              baseViewName: _get(
                defaults,
                'baseViewName',
                // Things are not set in stone yet, we might want to bring back this behaviour
                // (https://github.com/SBRG/kg-prototypes/pull/1927)
                // sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane
                ViewBase.sankeySingleLane
              ),
            })),
            map((state) => _mergeAll([{}, state, delta]))
          ),
          of(delta)
        )
      )
    )
    .pipe(debug('state$'), shareReplay({ bufferSize: 1, refCount: true }));

  readonly networkTraceIdx$ = this.stateAccessor('networkTraceIdx');
  readonly baseViewName$ = this.stateAccessor('baseViewName');
  // do not use standart accessor for this one cause we want null if it wasnt set
  readonly viewName$ = this.state$.pipe(
    map(({ viewName = null }) => viewName),
    distinctUntilChanged()
  );

  readonly data$ = this._data$.pipe(
    $freezeInDev,
    map((file) => new SankeyDocument(file, this.warningController)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * Observable of current view options
   * based on currently loaded data and choosen base view
   */
  readonly options$ = this.data$.pipe(
    map((data) => _mergeAll([{}, this.staticOptions, this.extractOptionsFromGraph(data)])),
    debug('options$'),
    shareReplay<SankeyOptions>(1)
  );

  readonly networkTrace$ = this.optionStateAccessor<TraceNetwork>(
    'networkTraces',
    'networkTraceIdx'
  );

  readonly networkTraces$ = unifiedSingularAccessor(this.options$, 'networkTraces');

  readonly views$ = this.networkTrace$.pipe(
    switchMap((trace) => trace.views$),
    debug('views$'),
    shareReplay<Record<string, View>>(1)
  );
  /**
   * Returns active view or null if no view is active
   */
  readonly view$ = this.views$.pipe(
    switchMap((views) => this.viewName$.pipe(map((viewName) => views[viewName as string] ?? null))),
    debug('view'),
    shareReplay<View>({ bufferSize: 1, refCount: true })
  );

  readonly viewsUpdate$: Subject<SankeyViews> = new Subject<SankeyViews>();
  readonly fontSizeScale$ = this.stateAccessor('fontSizeScale');

  readonly labelEllipsis$ = this.stateAccessor('labelEllipsis');

  /**
   * Predefined options for Sankey visualisation which are not based on loaded data not user input
   */
  readonly staticOptions: SankeyStaticOptions = Object.freeze({
    aligns,
    predefinedValueAccessors: {
      [PREDEFINED_VALUE.fixed_height]: {
        description: PREDEFINED_VALUE.fixed_height,
        linkValueAccessorId: LINK_VALUE_GENERATOR.fixedValue1,
        nodeValueAccessorId: NODE_VALUE_GENERATOR.none,
      },
      [PREDEFINED_VALUE.input_count]: {
        description: PREDEFINED_VALUE.input_count,
        linkValueAccessorId: LINK_VALUE_GENERATOR.input_count,
        nodeValueAccessorId: NODE_VALUE_GENERATOR.none,
      },
    },
    linkValueGenerators: {
      [LINK_VALUE_GENERATOR.fixedValue0]: {
        description: LINK_VALUE_GENERATOR.fixedValue0,
      },
      [LINK_VALUE_GENERATOR.fixedValue1]: {
        description: LINK_VALUE_GENERATOR.fixedValue1,
      },
      // [LINK_VALUE_GENERATOR.fraction_of_fixed_nodevalue]: {
      //   description: LINK_VALUE_GENERATOR.fraction_of_fixed_nodevalue
      // },
      [LINK_VALUE_GENERATOR.input_count]: {
        description: LINK_VALUE_GENERATOR.input_count,
      },
    },
    nodeValueGenerators: {
      [NODE_VALUE_GENERATOR.none]: {
        description: NODE_VALUE_GENERATOR.none,
      },
      [NODE_VALUE_GENERATOR.fixedValue1]: {
        description: NODE_VALUE_GENERATOR.fixedValue1,
      },
    },
    prescalers,
  });

  // Using setter on private property to ensure that nobody subscribes to raw data
  set data(data: Graph.File) {
    this._data$.next(data);
  }

  readonly oneToMany$ = this.networkTrace$.pipe(
    map(({ sources, targets }) => Math.min(sources.length, targets.length) === 1)
  );
  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', 'id']);

  readonly prescaler$ = this.optionStateAccessor<Prescaler>('prescalers', 'prescalerId');
  readonly align$ = this.optionStateAccessor<Align>('aligns', 'alignId');

  readonly pathReports$ = this.data$.pipe(
    map(({ nodes, getNodeById, links, graph: { traceNetworks } }) =>
      _transform(
        traceNetworks,
        (pathReports, traceNetwork) =>
          (pathReports[traceNetwork.description] = traceNetwork.traces.map((trace) => {
            const traceLinks = trace.edges.map((linkIdx) => ({ ...links[linkIdx] }));
            const traceNodes = this.getNetworkTraceNodes(traceLinks).map(_clone);
            const traceNodesById = this.getNodeById(traceNodes);

            const source = traceNodesById.get(trace.source);
            const target = traceNodesById.get(trace.target);
            if (_isNil(source)) {
              this.warningController.warn(ErrorMessages.missingNode(trace.source));
            }
            if (_isNil(target)) {
              this.warningController.warn(ErrorMessages.missingNode(trace.target));
            }

            const report: SankeyPathReportEntity[] = [];
            const traversed = new WeakSet();

            function traverse(node, row = 1, column = 1) {
              if (node !== target) {
                report.push({
                  row,
                  column,
                  label: node.label,
                  type: 'node',
                });
                column++;
                report.push({
                  row,
                  column,
                  label: ' | ',
                  type: 'spacer',
                });
                column++;
                traceLinks
                  .filter((l) => l.source === node.id)
                  .forEach((sl) => {
                    if (traversed.has(sl)) {
                      report.push({
                        row,
                        column,
                        label: `Circular link: ${sl.label}`,
                        type: 'link',
                      });
                      row++;
                    } else {
                      traversed.add(sl);
                      report.push({
                        row,
                        column,
                        label: sl.label,
                        type: 'link',
                      });
                      column++;
                      report.push({
                        row,
                        column,
                        label: ' | ',
                        type: 'spacer',
                      });
                      column++;
                      const targetNode = traceNodesById.get(sl.target);
                      report.push({
                        row,
                        column,
                        label: targetNode.label,
                        type: 'node',
                      });
                      row = traverse(targetNode, row + 1, column);
                    }
                  });
              }
              return row;
            }

            traverse(source);

            return report;
          })),
        {}
      )
    ),
    debug('pathReports$'),
    // It's very heavy to compute (all posibilities - usually over 1000 results), keep it hot till dataWithUtils$ is destroyed
    shareReplay(1)
  );

  readonly predefinedValueAccessors$ = this.options$.pipe(
    map(({ predefinedValueAccessors }) => predefinedValueAccessors)
  );

  readonly networkTraceDefaultSizing$ = this.networkTrace$.pipe(
    switchMap((networkTrace) =>
      iif(
        () => networkTrace.defaultSizing,
        of(networkTrace._defaultSizing),
        defer(() => this.getNetworkTraceBestFittingSizing$(networkTrace))
      )
    )
  );

  readonly prescalers$ = unifiedSingularAccessor(this.options$, 'prescalers');
  readonly maximumLabelLength$ = unifiedSingularAccessor(this.options$, 'maximumLabelLength');
  readonly maximumShortestPathPlusN$ = unifiedSingularAccessor(
    this.options$,
    'maximumShortestPathPlusN'
  );
  readonly aligns$ = unifiedSingularAccessor(this.options$, 'aligns');
  readonly linkValueGenerators$ = unifiedSingularAccessor(this.options$, 'linkValueGenerators');
  readonly linkValueAccessors$ = unifiedSingularAccessor(this.options$, 'linkValueAccessors');
  readonly nodeValueGenerators$ = unifiedSingularAccessor(this.options$, 'nodeValueGenerators');
  readonly nodeValueAccessors$ = unifiedSingularAccessor(this.options$, 'nodeValueAccessors');
  readonly normalizeLinks$ = this.stateAccessor('normalizeLinks');
  readonly fileUpdated$ = new Subject<Graph.File>();

  ngOnDestroy() {
    this.destroyed$.next();
  }

  pickPartialAccessors = (obj) => _pick(obj, ['nodeValueAccessorId', 'linkValueAccessorId']);

  getNetworkTraceBestFittingSizing$({ effectiveName }) {
    const persumedValueAccessorRegex = /reverse|rev.?pagerank/i.test(effectiveName)
      ? /rev.?pagerank/i
      : /forward|pagerank/i.test(effectiveName)
      ? /pagerank/i
      : undefined;
    return this.predefinedValueAccessors$.pipe(
      switchMap((predefinedValueAccessors) => {
        const persumedValueAccessorId = _keys(predefinedValueAccessors).find((pva) =>
          persumedValueAccessorRegex?.test(pva)
        );
        return iif(
          () => _isNil(persumedValueAccessorId),
          this.oneToMany$.pipe(
            map((oneToMany) =>
              oneToMany ? PREDEFINED_VALUE.input_count : PREDEFINED_VALUE.fixed_height
            )
          ),
          of(persumedValueAccessorId)
        );
      })
    );
  }

  resolveNetworkTraceAndBaseView(
    delta$: Observable<Partial<SankeyState>>,
    defaultNetworkTraceIdx = 0
  ) {
    return delta$.pipe(
      map((delta) => _pick(delta, ['networkTraceIdx', 'baseViewName'])),
      distinctUntilChanged(_isEqual),
      switchMap(({ networkTraceIdx = defaultNetworkTraceIdx, baseViewName }) =>
        iif(
          () => baseViewName,
          of({ networkTraceIdx }),
          this.data$.pipe(
            map(({ graph: { traceNetworks, nodeSets } }) => {
              const { sources, targets } = traceNetworks[networkTraceIdx];
              return {
                networkTraceIdx,
                baseViewName:
                  sources.length > 1 && targets.length > 1
                    ? ViewBase.sankeySingleLane
                    : ViewBase.sankeyMultiLane,
              };
            })
          )
        )
      ),
      debug('resolveNetworkTraceAndBaseView')
    );
  }

  resolveNodeAlign(delta$: Observable<Partial<SankeyState>>, defaultNetworkTraceIdx = 0) {
    return delta$.pipe(
      map((delta) => _pick(delta, ['networkTraceIdx', 'alignId'])),
      distinctUntilChanged(_isEqual),
      switchMap(({ networkTraceIdx = defaultNetworkTraceIdx, alignId }) =>
        iif(
          () => alignId,
          of({ alignId }),
          this.data$.pipe(
            first(),
            map(({ graph: { traceNetworks } }) => {
              const { sources, targets } = traceNetworks[networkTraceIdx];
              return {
                alignId: sources.length > targets.length ? ALIGN_ID.right : ALIGN_ID.left,
              };
            })
          )
        )
      ),
      debug('resolveNodeAlign')
    );
  }

  resolveView(delta$: Observable<Partial<SankeyState>>) {
    return delta$.pipe(
      // track change
      startWith(null),
      pairwise(),
      switchMap(([previousDelta, delta]) =>
        iif(
          () => _isNil(delta.viewName),
          of({}),
          this.views$.pipe(
            map((views, index) => views[delta.viewName]),
            switchMap((view) => iif(() => _isNil(view), EMPTY, of(view))),
            map((view) =>
              _merge(
                getCommonState(view.state),
                // if there was no change of view name allow for the view to be updated
                previousDelta.viewName === delta.viewName ? _omit(delta, 'baseViewName') : {}
              )
            )
          )
        )
      ),
      debug('resolveView')
    );
  }

  selectNetworkTrace(networkTraceIdx: number) {
    return this.setState({ networkTraceIdx });
  }

  loadData(data: Graph.File) {
    // this.preprocessData(data);
    this.data = data;
    return of(true);
  }

  resetState() {
    this.delta$.next({});
  }

  resetView() {
    return this.setState({
      networkTraceIdx: null,
      viewName: null,
    });
  }

  // Trace logic

  /**
   * Helper to create Map for fast lookup
   */
  private getNodeById<T extends { id: SankeyId }>(nodes: T[]) {
    return indexByProperty(nodes, 'id');
  }

  /**
   * Given links find all nodes they are connecting to and replace id ref with objects
   * Should return copy of nodes Objects (do not mutate nodes!)
   */
  getNetworkTraceNodes(networkTraceLinks) {
    return _flow(
      _flatMap(({ source, target }) => [source, target]),
      _uniq
    )(networkTraceLinks);
  }

  // region Extract options
  private extractLinkValueProperties({ links: sankeyLinks, graph: { sizing } }) {
    const predefinedPropertiesToFind = new Set(
      Object.values(sizing ?? {}).map(({ link_sizing }) => link_sizing)
    );
    const linkValueAccessors = {};
    // extract all numeric properties
    for (const link of sankeyLinks) {
      for (const [k, v] of Object.entries(link)) {
        if (!linkValueAccessors[k] && !this.excludedProperties.has(k)) {
          if (isPositiveNumber(v)) {
            linkValueAccessors[k] = {
              description: k,
              type: LINK_PROPERTY_GENERATORS.byProperty,
            };
          } else if (
            Array.isArray(v) &&
            v.length === 2 &&
            isPositiveNumber(v[0]) &&
            isPositiveNumber(v[1])
          ) {
            linkValueAccessors[k] = {
              description: k,
              type: LINK_PROPERTY_GENERATORS.byArrayProperty,
            };
          }
          predefinedPropertiesToFind.delete(k);
        }
      }
      if (!predefinedPropertiesToFind.size) {
        break;
      }
    }
    if (predefinedPropertiesToFind.size) {
      this.warningController.warn(
        ErrorMessages.incorrectLinkValueAccessor(predefinedPropertiesToFind)
      );
    }
    return linkValueAccessors;
  }

  private extractNodeValueProperties({ nodes: sankeyNodes, graph: { sizing } }) {
    const predefinedPropertiesToFind = new Set(
      Object.values(sizing ?? {}).map(({ node_sizing }) => node_sizing)
    );
    const nodeValueAccessors = {};
    // extract all numeric properties
    for (const node of sankeyNodes) {
      for (const [k, v] of Object.entries(node)) {
        if (!nodeValueAccessors[k] && isPositiveNumber(v) && !this.excludedProperties.has(k)) {
          nodeValueAccessors[k] = {
            description: k,
          };
          predefinedPropertiesToFind.delete(k);
        }
      }
      if (!predefinedPropertiesToFind.size) {
        break;
      }
    }
    if (predefinedPropertiesToFind.size) {
      this.warningController.warn(
        ErrorMessages.incorrectNodeValueAccessor(predefinedPropertiesToFind)
      );
    }
    return nodeValueAccessors;
  }

  private extractPredefinedValueProperties({ sizing = {} }: { sizing: Graph.PredefinedSizing }) {
    return _transform(
      sizing,
      (predefinedValueAccessors, { node_sizing, link_sizing }, name) => {
        predefinedValueAccessors[name] = {
          description: name,
          nodeValueAccessorId: node_sizing,
          linkValueAccessorId: link_sizing,
        };
      },
      {}
    );
  }

  private findMaximumLabelLength(nodes: SankeyNode[]) {
    return max(nodes, ({ label = '' }) => label.length);
  }

  private extractshortestPathPlusN({
    traceNetworks,
  }: {
    traceNetworks: Array<SankeyTraceNetwork>;
  }) {
    return _flow(
      _flatMap(({ traces }) => traces),
      _map(({ shortestPathPlusN }) => shortestPathPlusN),
      max
    )(traceNetworks);
  }

  private extractOptionsFromGraph({ links, graph, nodes }): SankeyFileOptions {
    return {
      networkTraces: graph.traceNetworks,
      maximumShortestPathPlusN: this.extractshortestPathPlusN(graph),
      predefinedValueAccessors: this.extractPredefinedValueProperties(graph),
      linkValueAccessors: this.extractLinkValueProperties({ links, graph }),
      nodeValueAccessors: this.extractNodeValueProperties({ nodes, graph }),
      maximumLabelLength: this.findMaximumLabelLength(nodes),
    };
  }
}
