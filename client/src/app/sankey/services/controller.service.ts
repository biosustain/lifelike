import { Injectable } from '@angular/core';

import { of, Subject, iif, ReplaySubject, Observable, EMPTY } from 'rxjs';
import { merge, transform, clone, flatMap, pick, isEqual, uniq, isNil, omit, mapValues } from 'lodash-es';
import { switchMap, map, first, shareReplay, distinctUntilChanged, startWith, pairwise } from 'rxjs/operators';
import { max } from 'd3';

import { GraphPredefinedSizing, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { SankeyState, SankeyFileOptions, SankeyStaticOptions, ViewBase, SankeyId, SankeyOptions } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { debug } from 'app/shared/rxjs/debug';
import { $freezeInDev } from 'app/shared/rxjs/development';

import { prescalers } from '../constants/prescalers';
import { aligns } from '../constants/aligns';
import { isPositiveNumber, indexByProperty } from '../utils';
import { LayoutService } from './layout.service';
import { unifiedSingularAccessor } from '../utils/rxjs';
import { StateControlAbstractService } from '../abstract/state-control.service';
import { getCommonState } from '../utils/stateLevels';
import { ErrorMessages } from '../constants/error';
import { PRESCALER_ID, Prescaler } from '../interfaces/prescalers';
import { PREDEFINED_VALUE, LINK_VALUE_GENERATOR, NODE_VALUE_GENERATOR, LINK_PROPERTY_GENERATORS } from '../interfaces/valueAccessors';
import { SankeyViews } from '../interfaces/view';
import { SankeyPathReportEntity } from '../interfaces/report';
import { Align, ALIGN_ID } from '../interfaces/align';
import { SankeyDocument, TraceNetwork, SankeyNode, View } from '../model/sankey-document';

/**
 * Reducer pipe
 * given state and patch, can return new state or modify it in place
 */
export function patchReducer(patch, callback) {
  return switchMap(stateDelta => callback(stateDelta, patch) ?? of(stateDelta));
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
export class ControllerService extends StateControlAbstractService<SankeyOptions, SankeyState> {
  constructor(
    readonly warningController: WarningControllerService
  ) {
    super();
  }

  delta$ = new ReplaySubject<Partial<SankeyState>>(1);
  private _data$ = new ReplaySubject<GraphFile>(1);

  state$ = this.delta$.pipe(
    switchMap(delta =>
      iif(
        () => !isNil(delta.viewName) && !isNil(delta.networkTraceIdx),
        this.data$.pipe(
          map(({graph: {traceNetworks}}) => traceNetworks[delta.networkTraceIdx]),
          map(({views}) => views[delta.viewName]),
          map(view => getCommonState((view as View).state)),
          map(state => merge({}, state, delta))
        ),
        of(delta)
      )
    ),
    map(delta => merge(
      {},
      {
        networkTraceIdx: 0,
        normalizeLinks: false,
        prescalerId: PRESCALER_ID.none,
        labelEllipsis: {
          enabled: true,
          value: LayoutService.labelEllipsis
        },
        fontSizeScale: 1.0
      },
      delta
    )),
    switchMap((delta: Partial<SankeyState>) =>
      iif(
        () => !isNil(delta.networkTraceIdx),
        this.data$.pipe(
          map(({graph: {traceNetworks}}) => traceNetworks[delta.networkTraceIdx]),
          map(({sources, targets}) => ({
            alignId: sources.length > targets.length ? ALIGN_ID.right : ALIGN_ID.left,
            baseViewName: sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane
          })),
          map(state => merge({}, state, delta))
        ),
        of(delta)
      )
    )
  ).pipe(
    debug('state$'),
    shareReplay({bufferSize: 1, refCount: true})
  );

  //   this.delta$.pipe(
  //   publish(delta$ =>
  //     combineLatest([,
  //       delta$,
  //       this.resolveNetworkTraceAndBaseView(delta$),
  //       this.resolveNodeAlign(delta$),
  //       this.resolveView(delta$)
  //     ])
  //   ),
  //   map((deltas) => merge({}, ...deltas)),
  //   distinctUntilChanged(isEqual),
  //   debug('state$'),
  //   shareReplay(1)
  // );
  networkTraceIdx$ = this.stateAccessor('networkTraceIdx');
  baseViewName$ = this.stateAccessor('baseViewName');
  // do not use standart accessor for this one cause we want null if it wasnt set
  viewName$ = this.state$.pipe(
    map(({viewName = null}) => viewName),
    distinctUntilChanged()
  );

  data$ = this._data$.pipe(
    $freezeInDev,
    map(file => new SankeyDocument(file)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /**
   * Observable of current view options
   * based on currently loaded data and choosen base view
   */
  options$ = this.data$.pipe(
    map(data => merge(
      {},
      this.staticOptions,
      this.extractOptionsFromGraph(data)
    )),
    debug('options$'),
    shareReplay<SankeyOptions>(1)
  );

  networkTrace$ = this.optionStateAccessor<TraceNetwork>('networkTraces', 'networkTraceIdx');

  networkTraces$ = unifiedSingularAccessor(this.options$, 'networkTraces');

  views$ = this.networkTrace$.pipe(
    switchMap(trace => trace.views$),
    debug('views$'),
    shareReplay<Record<string, View>>(1)
  );
  /**
   * Returns active view or null if no view is active
   */
  view$ = this.views$.pipe(
    switchMap(views => this.viewName$.pipe(
      map(viewName => views[viewName as string] ?? null),
    )),
    distinctUntilChanged(),
    debug('view'),
    shareReplay<View>(1)
  );

  viewsUpdate$: Subject<SankeyViews> = new Subject<SankeyViews>();
  fontSizeScale$ = this.stateAccessor('fontSizeScale');

  labelEllipsis$ = this.stateAccessor('labelEllipsis');

  /**
   * Predefined options for Sankey visualisation which are not based on loaded data not user input
   */
  readonly staticOptions: SankeyStaticOptions = Object.freeze({
    aligns,
    predefinedValueAccessors: {
      [PREDEFINED_VALUE.fixed_height]: {
        description: PREDEFINED_VALUE.fixed_height,
        linkValueAccessorId: LINK_VALUE_GENERATOR.fixedValue1,
        nodeValueAccessorId: NODE_VALUE_GENERATOR.none
      },
      [PREDEFINED_VALUE.input_count]: {
        description: PREDEFINED_VALUE.input_count,
        linkValueAccessorId: LINK_VALUE_GENERATOR.input_count,
        nodeValueAccessorId: NODE_VALUE_GENERATOR.none
      }
    },
    linkValueGenerators: {
      [LINK_VALUE_GENERATOR.fixedValue0]: {
        description: LINK_VALUE_GENERATOR.fixedValue0
      },
      [LINK_VALUE_GENERATOR.fixedValue1]: {
        description: LINK_VALUE_GENERATOR.fixedValue1
      },
      // [LINK_VALUE_GENERATOR.fraction_of_fixed_nodevalue]: {
      //   description: LINK_VALUE_GENERATOR.fraction_of_fixed_nodevalue
      // },
      [LINK_VALUE_GENERATOR.input_count]: {
        description: LINK_VALUE_GENERATOR.input_count
      },
    },
    nodeValueGenerators: {
      [NODE_VALUE_GENERATOR.none]: {
        description: NODE_VALUE_GENERATOR.none
      },
      [NODE_VALUE_GENERATOR.fixedValue1]: {
        description: NODE_VALUE_GENERATOR.fixedValue1
      }
    },
    prescalers
  });


  // Using setter on private property to ensure that nobody subscribes to raw data
  set data(data: GraphFile) {
    this._data$.next(data);
  }

  oneToMany$ = this.networkTrace$.pipe(
    map(({sources, targets}) =>
      Math.min(sources.length, targets.length) === 1
    )
  );

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', 'id']);

  prescaler$ = this.optionStateAccessor<Prescaler>('prescalers', 'prescalerId');
  align$ = this.optionStateAccessor<Align>('aligns', 'alignId');

  pathReports$ = this.data$.pipe(
    map(({nodes, nodeById, links, graph: {traceNetworks}}) =>
      transform(
        traceNetworks,
        (pathReports, traceNetwork) => pathReports[traceNetwork.description] = traceNetwork.traces.map(trace => {
          const traceLinks = trace.edges.map(linkIdx => ({...links[linkIdx]}));
          const traceNodes = this.getNetworkTraceNodes(traceLinks, nodeById).map(clone);
          const traceNodesById = this.getNodeById(traceNodes);

          const source = traceNodesById.get(trace.source);
          const target = traceNodesById.get(trace.target);

          const report: SankeyPathReportEntity[] = [];
          const traversed = new WeakSet();

          function traverse(node, row = 1, column = 1) {
            if (node !== target) {
              report.push({
                row,
                column,
                label: node.label,
                type: 'node'
              });
              column++;
              report.push({
                row,
                column,
                label: ' | ',
                type: 'spacer'
              });
              column++;
              traceLinks.filter(l => l.source === node.id).forEach(sl => {
                if (traversed.has(sl)) {
                  report.push({
                    row,
                    column,
                    label: `Circular link: ${sl.label}`,
                    type: 'link'
                  });
                  row++;
                } else {
                  traversed.add(sl);
                  report.push({
                    row,
                    column,
                    label: sl.label,
                    type: 'link'
                  });
                  column++;
                  report.push({
                    row,
                    column,
                    label: ' | ',
                    type: 'spacer'
                  });
                  column++;
                  const targetNode = traceNodesById.get(sl.target);
                  report.push({
                    row,
                    column,
                    label: targetNode.label,
                    type: 'node'
                  });
                  row = traverse(targetNode, row + 1, column);
                }
              });
            }
            return row;
          }

          traverse(source);

          return report;
        }),
        {}
      )
    ),
    debug('pathReports$'),
    // It's very heavy to compute (all posibilities - usually over 1000 results), keep it hot till dataWithUtils$ is destroyed
    shareReplay(1)
  );

  predefinedValueAccessors$ = this.options$.pipe(
    map(({predefinedValueAccessors}) => predefinedValueAccessors)
  );

  networkTraceDefaultSizing$ = this.networkTrace$.pipe(
    switchMap(({defaultSizing}) =>
      iif(
        () => defaultSizing,
        of(defaultSizing),
        this.oneToMany$.pipe(
          map(oneToMany => oneToMany ? PREDEFINED_VALUE.input_count : PREDEFINED_VALUE.fixed_height),
        )
      )
    )
  );

  prescalers$ = unifiedSingularAccessor(this.options$, 'prescalers');
  maximumLabelLength$ = unifiedSingularAccessor(this.options$, 'maximumLabelLength');
  aligns$ = unifiedSingularAccessor(this.options$, 'aligns');
  linkValueGenerators$ = unifiedSingularAccessor(this.options$, 'linkValueGenerators');
  linkValueAccessors$ = unifiedSingularAccessor(this.options$, 'linkValueAccessors');
  nodeValueGenerators$ = unifiedSingularAccessor(this.options$, 'nodeValueGenerators');
  nodeValueAccessors$ = unifiedSingularAccessor(this.options$, 'nodeValueAccessors');
  normalizeLinks$ = this.stateAccessor('normalizeLinks');
  fileUpdated$ = new Subject<GraphFile>();


  resolveNetworkTraceAndBaseView(delta$: Observable<Partial<SankeyState>>, defaultNetworkTraceIdx = 0) {
    return delta$.pipe(
      map(delta => pick(delta, ['networkTraceIdx', 'baseViewName'])),
      distinctUntilChanged(isEqual),
      switchMap(({networkTraceIdx = defaultNetworkTraceIdx, baseViewName}) =>
        iif(
          () => baseViewName,
          of({networkTraceIdx}),
          this.data$.pipe(
            map(({graph: {traceNetworks, nodeSets}}) => {
              const {sources, targets} = traceNetworks[networkTraceIdx];
              return {
                networkTraceIdx,
                baseViewName: sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane
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
      map(delta => pick(delta, ['networkTraceIdx', 'alignId'])),
      distinctUntilChanged(isEqual),
      switchMap(({networkTraceIdx = defaultNetworkTraceIdx, alignId}) =>
        iif(
          () => alignId,
          of({alignId}),
          this.data$.pipe(
            first(),
            map(({graph: {traceNetworks}}) => {
              const {sources, targets} = traceNetworks[networkTraceIdx];
              return {
                alignId: sources.length > targets.length ? ALIGN_ID.right : ALIGN_ID.left
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
          () => isNil(delta.viewName),
          of({}),
          this.views$.pipe(
            map((views, index) => views[delta.viewName]),
            switchMap(view =>
              iif(
                () => isNil(view),
                EMPTY,
                of(view)
              )
            ),
            map(view => merge(
              getCommonState(view.state),
              // if there was no change of view name allow for the view to be updated
              (previousDelta.viewName === delta.viewName ? omit(delta, 'baseViewName') : {})
            ))
          )
        )
      ),
      debug('resolveView')
    );
  }

  selectNetworkTrace(networkTraceIdx: number) {
    return this.patchState(
      {
        networkTraceIdx,
        baseViewName: null,
        viewName: null,
      },
      (delta, patch) =>
        merge({}, mapValues(delta, () => null), patch)
    );
  }

  loadData(data: GraphFile) {
    // this.preprocessData(data);
    this.data = data;
    return of(true);
  }

  resetState() {
    this.delta$.next({});
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
  getNetworkTraceNodes(
    networkTraceLinks,
    nodeById: Map<SankeyId, Readonly<SankeyNode>>
  ) {
    return uniq(
      flatMap(networkTraceLinks, ({source, target}) => [source, target])
    );
  }

  // region Extract options
  private extractLinkValueProperties({links: sankeyLinks, graph: {sizing}}) {
    const predefinedPropertiesToFind = new Set(Object.values(sizing ?? {}).map(({link_sizing}) => link_sizing));
    const linkValueAccessors = {};
    // extract all numeric properties
    for (const link of sankeyLinks) {
      for (const [k, v] of Object.entries(link)) {
        if (!linkValueAccessors[k] && !this.excludedProperties.has(k)) {
          if (isPositiveNumber(v)) {
            linkValueAccessors[k] = {
              description: k,
              type: LINK_PROPERTY_GENERATORS.byProperty
            };
          } else if (Array.isArray(v) && v.length === 2 && isPositiveNumber(v[0]) && isPositiveNumber(v[1])) {
            linkValueAccessors[k] = {
              description: k,
              type: LINK_PROPERTY_GENERATORS.byArrayProperty
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
      this.warningController.warn(ErrorMessages.incorrectLinkValueAccessor(predefinedPropertiesToFind));
    }
    return linkValueAccessors;
  }

  private extractNodeValueProperties({nodes: sankeyNodes, graph: {sizing}}) {
    const predefinedPropertiesToFind = new Set(Object.values(sizing ?? {}).map(({node_sizing}) => node_sizing));
    const nodeValueAccessors = {};
    // extract all numeric properties
    for (const node of sankeyNodes) {
      for (const [k, v] of Object.entries(node)) {
        if (!nodeValueAccessors[k] && isPositiveNumber(v) && !this.excludedProperties.has(k)) {
          nodeValueAccessors[k] = {
            description: k
          };
          predefinedPropertiesToFind.delete(k);
        }
      }
      if (!predefinedPropertiesToFind.size) {
        break;
      }
    }
    if (predefinedPropertiesToFind.size) {
      this.warningController.warn(ErrorMessages.incorrectNodeValueAccessor(predefinedPropertiesToFind));
    }
    return nodeValueAccessors;
  }

  private extractPredefinedValueProperties({sizing = {}}: { sizing: GraphPredefinedSizing }) {
    return transform(
      sizing,
      (predefinedValueAccessors, {node_sizing, link_sizing}, name) => {
        predefinedValueAccessors[name] = {
          description: name,
          nodeValueAccessorId: node_sizing,
          linkValueAccessorId: link_sizing
        };
      },
      {}
    );
  }

  private findMaximumLabelLength(nodes: SankeyNode[]) {
    return max(nodes, ({label = ''}) => label.length);
  }

  private extractOptionsFromGraph({links, graph, nodes}): SankeyFileOptions {
    return {
      networkTraces: graph.traceNetworks,
      predefinedValueAccessors: this.extractPredefinedValueProperties(graph),
      linkValueAccessors: this.extractLinkValueProperties({links, graph}),
      nodeValueAccessors: this.extractNodeValueProperties({nodes, graph}),
      maximumLabelLength: this.findMaximumLabelLength(nodes)
    };
  }

  resetController() {
    return this.data$.pipe(
      first(),
      // todo
      // switchMap(data => this.loadData(data))
    ).toPromise();
  }
}
