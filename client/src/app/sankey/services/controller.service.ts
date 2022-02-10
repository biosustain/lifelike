import { Injectable } from '@angular/core';

import { of, Subject, iif, throwError, ReplaySubject, combineLatest, BehaviorSubject, merge as rx_merge, Observable } from 'rxjs';
import { merge, transform, cloneDeepWith, clone, max, flatMap, has, pick, isEqual } from 'lodash-es';
import { switchMap, map, filter, catchError, first, tap, shareReplay, distinctUntilChanged } from 'rxjs/operators';
// @ts-ignore
import { tag } from 'rxjs-spy/operators/tag';


import { GraphPredefinedSizing, GraphNode, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import {
  SankeyData,
  SankeyTraceNetwork,
  SankeyLink,
  SankeyNode,
  SankeyPathReportEntity,
  SankeyId,
  SankeyState,
  LINK_VALUE_GENERATOR,
  NODE_VALUE_GENERATOR,
  PREDEFINED_VALUE,
  SankeyTrace,
  SankeyFileOptions,
  SankeyView,
  SankeyStaticOptions,
  ViewBase,
  Prescaler,
  ValueAccessor,
  LINK_PROPERTY_GENERATORS,
  SankeyViews
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { prescalers, PRESCALER_ID } from '../algorithms/prescalers';
import { isPositiveNumber } from '../utils';
import { StateControlAbstractService, unifiedSingularAccessor, unifiedAccessor } from './state-controlling-abstract.service';
import { LayoutService } from './layout.service';

export const customisedMultiValueAccessorId = 'Customised';

export const customisedMultiValueAccessor = {
  description: customisedMultiValueAccessorId
} as ValueAccessor;

enum SankeyActionType {
  selectNetworkTrace
}

interface SankeyAction {
  type: SankeyActionType;
  payload: any;
}

/**
 * Reducer pipe
 * given state and patch, can return new state or modify it in place
 */
export function patchReducer(patch, callback) {
  return switchMap(stateDelta => callback(stateDelta, patch) ?? of(stateDelta));
}

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class ControllerService extends StateControlAbstractService<SakeyOptions, SankeyState> {
  constructor(
    readonly warningController: WarningControllerService
  ) {
    super();
    this.onInit();
    this.state$.subscribe(state => {
      // side effect to load default state values if needed
      if (has(state, 'networkTraceIdx')) {
        return combineLatest([
          iif(
            // if there is no preset base view set it based on data
            () => !state.baseViewName,
            this.partialNetworkTraceData$.pipe(
              first(),
              map(({sources, targets}) => sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane),
              switchMap(bvn => this.patchDefaultState({
                baseViewName: (bvn as ViewBase)
              }))
            ),
            of({})
          )
        ]).pipe(
          map(defaultStatePatches => merge({}, ...defaultStatePatches)),
          tap(defaultStatePatch => this.patchDefaultState(defaultStatePatch)),
        ).toPromise();
      }
    });
  }

  baseViewName$: Observable<string>;
  baseView$: Observable<{ baseViewName: string, baseViewInitState: object }>;
  viewName$: Observable<string>;

  /**
   * Observable of current default state which is based inclusively on loaded data
   */
  default$ = new BehaviorSubject<SankeyState>(Object.freeze({
      networkTraceIdx: 0,
      normalizeLinks: false,
      prescalerId: PRESCALER_ID.none,
      labelEllipsis: {
        enabled: true,
        value: LayoutService.labelEllipsis
      },
      fontSizeScale: 1.0
    })
  );

  delta$ = new ReplaySubject<Partial<SankeyState>>(1);

  data$ = new ReplaySubject<SankeyData>(1);


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
    shareReplay(1)
  );

  viewsUpdate$: Subject<SankeyViews> = new Subject<SankeyViews>();

  views$ = rx_merge(
    this.data$.pipe(
      map(({_views = {}}) => _views),
      shareReplay(1)
    ),
    this.viewsUpdate$
  ).pipe(
    shareReplay(1)
  );

  /**
   * Returns active view or null if no view is active
   */
  view$: Observable<SankeyView | null>;

  /**
   * Predefined options for Sankey visualisation which are not based on loaded data not user input
   */
  readonly staticOptions: SankeyStaticOptions = Object.freeze({
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
      [LINK_VALUE_GENERATOR.fraction_of_fixed_node_value]: {
        description: LINK_VALUE_GENERATOR.fraction_of_fixed_node_value
      },
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

  networkTrace$ = this.optionStateAccessor('networkTraces', 'networkTraceIdx');

  oneToMany$ = this.networkTrace$.pipe(
    switchMap(({sources, targets}) => this.data$.pipe(
      map(({graph: {node_sets}}) => {
        const _inNodes = node_sets[sources];
        const _outNodes = node_sets[targets];
        return Math.min(_inNodes.length, _outNodes.length) === 1;
      })
    ))
  );

  partialNetworkTraceData$ = this.networkTrace$.pipe(
    switchMap(({sources, targets, traces}) => this.data$.pipe(
      map(({links, nodes, graph: {node_sets}}) => ({
        links,
        nodes,
        traces,
        sources: node_sets[sources],
        targets: node_sets[targets]
      }))
    )),
    shareReplay(1)
  );

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', '_id']);

  prescaler$ = this.optionStateAccessor<Prescaler>('prescalers', 'prescalerId');

  pathReports$ = this.data$.pipe(
    map(({nodes, links, graph: {trace_networks}}) =>
      transform(
        trace_networks,
        (pathReports, traceNetwork) => pathReports[traceNetwork.description] = traceNetwork.traces.map(trace => {
          const traceLinks = trace.edges.map(linkIdx => ({...links[linkIdx]}));
          const traceNodes = this.getNetworkTraceNodes(traceLinks, nodes).map(n => ({...n}));
          // @ts-ignore
          // todo
          // const layout = new LayoutService();
          // layout.computeNodeLinks({links: traceLinks, nodes: traceNodes});
          const source = traceNodes.find(n => n._id === String(trace.source));
          const target = traceNodes.find(n => n._id === String(trace.target));

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
              node._sourceLinks.forEach(sl => {
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
                  report.push({
                    row,
                    column,
                    label: sl._target.label,
                    type: 'node'
                  });
                  row = traverse(sl._target, row + 1, column);
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
    )
  );

  predefinedValueAccessors$ = this.options$.pipe(
    map(({predefinedValueAccessors}) => predefinedValueAccessors)
  );

  networkTraceDefaultSizing$ = this.networkTrace$.pipe(
    map(({defaultSizing}) => defaultSizing),
    filter(defaultSizing => !!defaultSizing),
    switchMap((defaultSizing: string) =>
      this.options$.pipe(
        switchMap(({predefinedValueAccessors}) =>
          iif(
            () => !!predefinedValueAccessors[defaultSizing],
            of(predefinedValueAccessors[defaultSizing]),
            throwError(new Error(`No predefined value accessor for ${defaultSizing}`))
          )
        )
      )
    ),
    catchError(error => {
      this.warningController.warn(error);
      return this.oneToMany$.pipe(
        map(oneToMany => oneToMany ? PREDEFINED_VALUE.input_count : PREDEFINED_VALUE.fixed_height),
      );
    })
  );

  prescalers$ = unifiedSingularAccessor(this.options$, 'prescalers');
  linkValueGenerators$ = unifiedSingularAccessor(this.options$, 'linkValueGenerators');
  linkValueAccessors$ = unifiedSingularAccessor(this.options$, 'linkValueAccessors');
  nodeValueGenerators$ = unifiedSingularAccessor(this.options$, 'nodeValueGenerators');
  nodeValueAccessors$ = unifiedSingularAccessor(this.options$, 'nodeValueAccessors');


  fileUpdated$ = new Subject<GraphFile>();

  onInit() {
    super.onInit();
    this.baseViewName$ = this.stateAccessor<ViewBase>('baseViewName');
    this.baseView$ = this.state$.pipe(
    filter(obj => has(obj, 'baseViewName')),
    map(obj => pick(obj, ['baseViewName', 'baseViewInitState'])),
    distinctUntilChanged(isEqual),
      shareReplay(1)
    );
    // do not use standart accessor for this one cause we want null if it wasnt set
    this.viewName$ = this.state$.pipe(
      map(({viewName = null}) => viewName),
      distinctUntilChanged()
    );
    this.view$ = this.views$.pipe(
      switchMap(views => this.viewName$.pipe(
        map(viewName => views[viewName] ?? null),
      )),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  patchDefaultState(patch: Partial<SankeyState>) {
    return this.default$.pipe(
      first(),
      map(defaultState => merge({}, defaultState, patch)),
      tap(defaultState => this.default$.next(defaultState))
    );
  }

  selectNetworkTrace(networkTraceIdx: number) {
    return this.patchState({
      networkTraceIdx,
      baseViewName: null,
      // todo check
      // predefinedValueAccessorId: null
    });
  }

  loadData(data: SankeyData) {
    this.preprocessData(data);
    this.data$.next(data);
    return of(true);
  }

  resetState() {
    this.delta$.next({});
  }

  // Trace logic
  /**
   * Extract links which relates to certain trace network and
   * assign _color property based on their trace.
   * Also creates duplicates if given link is used in multiple traces.
   * Should return copy of link Objects (do not mutate links!)
   */
  getAndColorNetworkTraceLinks(
    networkTrace: SankeyTraceNetwork,
    links: ReadonlyArray<Readonly<SankeyLink>>,
    colorMap?
  ) {
    throw new Error('Method not implemented.');
  }

  /**
   * Helper to create Map for fast lookup
   */
  getNodeById<T extends { _id: SankeyId }>(nodes: T[]) {
    // todo: find the way to declare it only once
    // tslint:disable-next-line
    const id = ({_id}, i?, nodes?) => _id;
    return new Map<number, T>(nodes.map((d, i) => [id(d, i, nodes), d]));
  }

  /**
   * Given links find all nodes they are connecting to and replace id ref with objects
   * Should return copy of nodes Objects (do not mutate nodes!)
   */
  getNetworkTraceNodes(
    networkTraceLinks,
    nodes: ReadonlyArray<Readonly<GraphNode>>
  ) {
    const nodeById = this.getNodeById(nodes.map(n => clone(n) as SankeyNode));
    return [
      ...networkTraceLinks.reduce((o, link) => {
        let {_source = link.source, _target = link.target} = link;
        if (typeof _source !== 'object') {
          _source = LayoutService.find(nodeById, _source);
        }
        if (typeof _target !== 'object') {
          _target = LayoutService.find(nodeById, _target);
        }
        o.add(_source);
        o.add(_target);
        return o;
      }, new Set<SankeyNode>())
    ];
  }

  computeData(): SankeyData {
    throw new Error('Not implemented');
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
      this.warningController.warn(`Predefined link value accessor accesses not existing properties: ${[...predefinedPropertiesToFind]}`);
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
      this.warningController.warn(`Predefined node value accessor accesses not existing properties: ${[...predefinedPropertiesToFind]}`);
    }
    return nodeValueAccessors;
  }

  private extractPredefinedValueProperties({sizing = {}}: { sizing: GraphPredefinedSizing }) {
    return transform(
      sizing,
      (predefinedValueAccessors, {node_sizing, link_sizing}, name) => {
        predefinedValueAccessors[name] = {
          description: name,
          nodeValueAccessorId: node_sizing ?? NODE_VALUE_GENERATOR.none,
          linkValueAccessorId: link_sizing ?? LINK_VALUE_GENERATOR.fraction_of_fixed_node_value
        };
      },
      {}
    );
  }

  private extractOptionsFromGraph({links, graph, nodes}): SankeyFileOptions {
    return {
      networkTraces: graph.trace_networks,
      predefinedValueAccessors: this.extractPredefinedValueProperties(graph),
      linkValueAccessors: this.extractLinkValueProperties({links, graph}),
      nodeValueAccessors: this.extractNodeValueProperties({nodes, graph})
    };
  }

  /**
   * Given nodes and links find all traces which they are relating to.
   */
  getRelatedTraces({nodes, links}) {
    // check nodes links for traces which are coming in and out
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {_sourceLinks, _targetLinks}) =>
        linksAccumulator.concat(_sourceLinks, _targetLinks)
      , []
    );
    // add links traces and reduce to unique values
    return new Set(flatMap(nodesLinks.concat([...links]), '_traces')) as Set<SankeyTrace>;
  }

  // endregion

  resetController() {
    return this.data$.pipe(
      first(),
      switchMap(data => this.loadData(data as SankeyData))
    ).toPromise();
  }

  preprocessData(content: SankeyData) {
    content.nodes.forEach(n => {
      n._id = n.id;
    });
    content.links.forEach((l, index) => {
      l._id = index;
    });
    content.graph.trace_networks.forEach(tn => {
      let maxVal = max(tn.traces.map(({group}) => group ?? -1));
      if (!isFinite(maxVal)) {
        maxVal = Math.random();
      }
      tn.traces.forEach(tr => {
        tr._group = tr.group ?? (tr.group === -1 && ++maxVal);
      });
    });
    return transform(content, (result, value, key) => {
      // only views are editable
      if (key === '_views') {
        result[key] = value;
      } else {
        result[key] = cloneDeepWith(value, Object.freeze);
      }
    }, {}) as SankeyData;
  }

  addIds(content) {
    content.nodes.forEach(n => {
      n._id = n.id;
    });
    content.links.forEach((l, i) => {
      l._id = i;
    });
  }

  load(content) {
    this.addIds(content);
    this.preprocessData(content);
    // this.resetOptions();
    // this.resetState();
    this.extractOptionsFromGraph(content);
  }


}
