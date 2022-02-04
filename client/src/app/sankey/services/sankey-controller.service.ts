import { Injectable } from '@angular/core';

import { of, Subject, iif, throwError, ReplaySubject, combineLatest, BehaviorSubject } from 'rxjs';
import { merge, omit, transform, cloneDeepWith, clone, max, isNil, flatMap, pick, omitBy, has } from 'lodash-es';
import { switchMap, map, filter, catchError, first, tap, shareReplay } from 'rxjs/operators';
// @ts-ignore
import { tag } from 'rxjs-spy/operators/tag';


import { GraphPredefinedSizing, GraphNode } from 'app/shared/providers/graph-type/interfaces';
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
  SankeyNodesOverwrites,
  SankeyLinksOverwrites,
  SankeyStaticOptions,
  ViewBase,
  Prescaler,
  ValueAccessor,
  LINK_PROPERTY_GENERATORS
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import { prescalers, PRESCALER_ID } from '../algorithms/prescalers';
import { isPositiveNumber } from '../utils';
import { StateControlAbstractService } from './state-controlling-abstract.service';
import { CustomisedSankeyLayoutService } from './customised-sankey-layout.service';

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
export class SankeyControllerService extends StateControlAbstractService<SakeyOptions, SankeyState> {
  constructor(
    readonly warningController: WarningControllerService
  ) {
    super();
    this.onInit();
    // this.stateDelta$.subscribe(d => console.log('state delta construct subscription', d));
    // this.defaultState$.subscribe(d => console.log('default state construct subscription', d));
    // this.partialNetworkTraceData$.subscribe(d => console.log('partialNetworkTraceData$ construct subscription', d));
    // this.data$.subscribe(d => console.log('data$ construct subscription', d));
    // this.options$.subscribe(d => console.log('options$ construct subscription', d));
    // this.dataToRender$.subscribe(d => console.log('dataToRender$ construct subscription', d));
    // this.viewsUpdate$.subscribe(d => console.log('viewsUpdate$ construct subscription', d));
    // this.views$.subscribe(d => console.log('views$ construct subscription', d));
    // this.networkTrace$.subscribe(d => console.log('networkTrace$ construct subscription', d));
    // this.oneToMany$.subscribe(d => console.log('oneToMany$ construct subscription', d));
    // this.prescaler$.subscribe(d => console.log('prescaler$ construct subscription', d));
    // this.networkTraceDefaultSizing$.subscribe(d => console.log('networkTraceDefaultSizing$ construct subscription', d));
    this.state$.subscribe(state => {
      // side effect to load default state values if needed
      if (has(state, 'networkTraceIdx')) {
        return combineLatest([
          iif(
            // if there is no preset base view set it based on data
            () => !state.baseViewName,
            this.partialNetworkTraceData$.pipe(
              tap(d => console.log('default baseViewName partialNetworkTraceData', d)),
              first(),
              map(({sources, targets}) => sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane),
              tap(d => console.log('default baseViewName calculated', d)),
              switchMap(bvn => this.patchDefaultState({
                baseViewName: (bvn as ViewBase)
              }))
            ),
            of({})
          )
        ]).pipe(
          map(defaultStatePatches => merge({}, ...defaultStatePatches)),
          tap(defaultStatePatch => this.patchDefaultState(defaultStatePatch)),
          tap(defaultStatePatch => console.log('defaultStatePatch', defaultStatePatch))
        ).toPromise();
      }
    });
  }

  baseViewName$: any;

  /**
   * Observable of current default state which is based inclusively on loaded data
   */
  default$ = new BehaviorSubject<SankeyState>(Object.freeze({
      networkTraceIdx: 0,
      normalizeLinks: false,
      prescalerId: PRESCALER_ID.none,
      labelEllipsis: {
        enabled: true,
        value: SankeyLayoutService.labelEllipsis
      },
      fontSizeScale: 1.0
    })
  );

  delta$ = new ReplaySubject<Partial<SankeyState>>(1);

  dataToRender$ = new ReplaySubject<SankeyData>(1);

  data$ = new ReplaySubject<SankeyData>(1);

  viewsUpdate$ = new Subject<{ [viewName: string]: SankeyView }>();

  /**
   * Observable of current view options
   * based on currently loaded data and choosen base view
   */
  options$ = this.data$.pipe(
    map(data => merge(
      {},
      this.staticOptions,
      this.extractOptionsFromGraph(data)
    ))
  );

  views$ = merge(
    this.data$.pipe(
      map(({_views}) => _views)
    ),
    this.viewsUpdate$
  );

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
      }
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
    tap(d => console.log('partialNetworkTraceData$ networkTrace:', d)),
    switchMap(({sources, targets, traces}) => this.data$.pipe(
      tap(d => console.log('partialNetworkTraceData$ data', d)),
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
          const layout = new SankeyLayoutService();
          layout.computeNodeLinks({links: traceLinks, nodes: traceNodes});
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

  onInit() {
    super.onInit();
    this.baseViewName$ = this.stateAccessor<ViewBase>('baseViewName');
  }

  patchDefaultState(patch: Partial<SankeyState>) {
    console.log('patchDefaultState', patch);
    return this.default$.pipe(
      first(),
      map(defaultState => merge({}, defaultState, patch)),
      tap(defaultState => this.default$.next(defaultState))
    );
  }

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  createView(viewName) {
    return this.delta$.pipe(
      switchMap((stateDelta: Partial<SankeyState>) => this.dataToRender$.pipe(
        map(({nodes, links}) => ({
          state: omit(stateDelta, this.statusOmitProperties),
          base: stateDelta.baseViewName,
          nodes: this.mapToPropertyObject(nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(links, this.linkViewProperties)
        } as SankeyView)),
        switchMap(view => this.views$.pipe(
          map((views: object) => this.views$.next({
            ...views,
            [viewName]: view
          }))
        )),
        map(() => this.patchState({
          viewName
        }))
      ))
    ).toPromise();
  }

  deleteView(viewName) {
    return this.views$.pipe(
      map((views: object) => omit(views, viewName)),
      switchMap(views => this.views$.pipe(
        tap(() => this.views$.next(views))
      )),
      // If the deleted view is the current view, switch to the base view
      switchMap(() => this.delta$.pipe(
        tap((stateDelta: Partial<SankeyState>) => {
          if (stateDelta.viewName === viewName) {
            this.delta$.next({
              ...stateDelta,
              viewName: null
            });
          }
        })
      ))
    ).toPromise();
  }

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
        this.patchState({
          viewName,
          ...view.state
        }).pipe(
          switchMap(stateDelta => this.partialNetworkTraceData$.pipe(
            map((networkTraceData: { links: SankeyLink[], nodes: SankeyNode[] }) => {
              (networkTraceData as any)._precomputedLayout = true;
              this.applyPropertyObject(view.nodes, networkTraceData.nodes);
              this.applyPropertyObject(view.links, networkTraceData.links);
              // @ts-ignore
              const layout = new CustomisedSankeyLayoutService(this);
              layout.computeNodeLinks(networkTraceData);
              return networkTraceData;
            })
          ))
        )
      )
    ).toPromise();
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
        this.delta$.next(stateDelta);
      })
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
          _source = SankeyLayoutService.find(nodeById, _source);
        }
        if (typeof _target !== 'object') {
          _target = SankeyLayoutService.find(nodeById, _target);
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

  applyState() {
    this.dataToRender$.next(
      this.computeData()
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

  computeGraph(stateUpdate?: Partial<SankeyState>) {
    // todo
    // Object.assign(this.state, stateUpdate);
    this.applyState();
  }
}
