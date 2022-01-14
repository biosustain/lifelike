import { Injectable } from '@angular/core';

import { Observable, of, Subject, iif, throwError, ReplaySubject, combineLatest } from 'rxjs';
import { merge, omit, transform, cloneDeepWith, clone, max, isNil, flatMap, assign, pick } from 'lodash-es';
import { switchMap, map, filter, catchError, first, tap } from 'rxjs/operators';

import { GraphPredefinedSizing, GraphNode } from 'app/shared/providers/graph-type/interfaces';
import {
  SankeyOptions,
  ValueGenerator,
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
  SankeyLinksOverwrites
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { prescalers, PRESCALER_ID } from '../algorithms/prescalers';
import { isPositiveNumber } from '../utils';
import { SankeyViewComponent } from '../components/sankey-view.component';
import { CustomisedSankeyLayoutService } from './customised-sankey-layout.service';

export const customisedMultiValueAccessorId = 'Customised';

export const customisedMultiValueAccessor = {
  description: customisedMultiValueAccessorId
} as ValueGenerator;

enum SankeyActionType {
  selectNetworkTrace
}

interface SankeyAction {
  type: SankeyActionType;
  payload: any;
}

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeyControllerService {
  constructor(
    readonly warningController: WarningControllerService
  ) {
    this.state$ = combineLatest([this.stateDelta$, this.defaultState$]).pipe(
      map(([delta, defaultState]) => merge({}, defaultState, delta))
    );
  }

  dataToRender$ = new ReplaySubject(undefined);

  options$ = new ReplaySubject<SankeyOptions>(1);
  stateDelta$ = new ReplaySubject<Partial<SankeyState>>(1);


  networkTraceData$: Observable<{ links: SankeyLink[], nodes: SankeyNode[] }>;

  data$ = new ReplaySubject<SankeyData>(1);

  viewsUpdate$ = new Subject<{ [viewName: string]: SankeyView }>();
  views$ = merge(
    this.data$.pipe(
      map(({_views}) => _views)
    ),
    this.viewsUpdate$
  );

  defaultOptions$: Observable<SankeyOptions> = of(Object.freeze({
    networkTraces: [],
    linkValueAccessors: {},
    nodeValueAccessors: {},
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
        description: LINK_VALUE_GENERATOR.fixedValue0,
        preprocessing: linkValues.fixedValue(0),
        disabled: () => false
      } as ValueGenerator,
      [LINK_VALUE_GENERATOR.fixedValue1]: {
        description: LINK_VALUE_GENERATOR.fixedValue1,
        preprocessing: linkValues.fixedValue(1),
        disabled: () => false
      } as ValueGenerator,
      [LINK_VALUE_GENERATOR.fraction_of_fixed_node_value]: {
        description: LINK_VALUE_GENERATOR.fraction_of_fixed_node_value,
        disabled: () => true, // todo: this.state.nodeValueAccessorId === NODE_VALUE_GENERATOR.none,
        requires: ({node}) => node.fixedValue,
        preprocessing: linkValues.fractionOfFixedNodeValue
      } as ValueGenerator
    },
    nodeValueGenerators: {
      [NODE_VALUE_GENERATOR.none]: {
        description: NODE_VALUE_GENERATOR.none,
        preprocessing: nodeValues.noneNodeValue,
        disabled: () => false
      } as ValueGenerator,
      [NODE_VALUE_GENERATOR.fixedValue1]: {
        description: NODE_VALUE_GENERATOR.fixedValue1,
        preprocessing: nodeValues.fixedValue(1),
        disabled: () => false
      } as ValueGenerator
    },
    prescalers
  }));
  defaultState$: Observable<SankeyState> = of(Object.freeze({
    nodeAlign: undefined,
    networkTraceIdx: 0,
    nodeHeight: {
      min: {
        enabled: true,
        value: 1
      },
      max: {
        enabled: false,
        ratio: 10
      }
    },
    normalizeLinks: false,
    linkValueAccessorId: undefined,
    nodeValueAccessorId: undefined,
    predefinedValueAccessorId: undefined,
    prescalerId: PRESCALER_ID.none,
    labelEllipsis: {
      enabled: true,
      value: SankeyLayoutService.labelEllipsis
    },
    fontSizeScale: 1.0
  }));

  state$: Observable<SankeyState>;

  networkTrace$ = this.simpleAccessor('networkTraces', 'networkTraceIdx');

  oneToMany$ = this.networkTrace$.pipe(
    switchMap(({sources, targets}) => this.data$.pipe(
      map(({graph: {node_sets}}) => {
        const _inNodes = node_sets[sources];
        const _outNodes = node_sets[targets];
        return Math.min(_inNodes.length, _outNodes.length) === 1;
      })
    ))
  );
  // noinspection JSVoidFunctionReturnValueUsed
  nodeValueAccessor$ = this.options$.pipe(
    switchMap(({nodeValueGenerators, nodeValueAccessors}) => this.state$.pipe(
      map(({nodeValueAccessorId}) =>
          nodeValueGenerators[nodeValueAccessorId] ??
          nodeValueAccessors[nodeValueAccessorId] ??
          this.warningController.warn(`Node values accessor ${nodeValueAccessorId} could not be found`),
        nodeValueGenerators[NODE_VALUE_GENERATOR.none]
      )
    ))
  );

  // noinspection JSVoidFunctionReturnValueUsed
  linkValueAccessor$ = this.options$.pipe(
    switchMap(({linkValueGenerators, linkValueAccessors}) => this.state$.pipe(
      map(({linkValueAccessorId}) =>
          linkValueGenerators[linkValueAccessorId] ??
          linkValueAccessors[linkValueAccessorId] ??
          this.warningController.warn(`Link values accessor ${linkValueAccessorId} could not be found`),
        linkValueGenerators[NODE_VALUE_GENERATOR.none]
      )
    ))
  );

  predefinedValueAccessor$ = this.options$.pipe(
    switchMap(({predefinedValueAccessors}) => this.state$.pipe(
      map(({predefinedValueAccessorId}) =>
        predefinedValueAccessorId === customisedMultiValueAccessorId ?
          customisedMultiValueAccessor :
          predefinedValueAccessors[predefinedValueAccessorId]
      )
    ))
  );

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', '_id']);

  prescaler$ = this.simpleAccessor('prescalers', 'prescalerId');

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

  networkTraceDefaultSizing$ = this.networkTrace$.pipe(
    map(({defaultSizing}) => defaultSizing),
    filter(defaultSizing => !!defaultSizing),
    switchMap((defaultSizing: string) =>
      this.options$.pipe(
        switchMap(({predefinedValueAccessors}) =>
          iif(
            () => predefinedValueAccessors[defaultSizing],
            of(defaultSizing),
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

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  createView(viewName) {
    return this.stateDelta$.pipe(
      switchMap(stateDelta => this.dataToRender$.pipe(
        map(({nodes, links}) => ({
          state: omit(stateDelta, this.statusOmitProperties),
          base: stateDelta.baseViewName,
          nodes: this.mapToPropertyObject(nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(links, this.linkViewProperties)
        } as SankeyView)),
        switchMap(view => this.views$.pipe(
          map(views => this.views$.next({
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
      map(views => omit(views, viewName)),
      switchMap(views => this.views$.pipe(
        tap(() => this.views$.next(views))
      )),
      // If the deleted view is the current view, switch to the base view
      switchMap(() => this.stateDelta$.pipe(
        tap(stateDelta => {
          if (stateDelta.viewName === viewName) {
            this.stateDelta$.next({
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
          switchMap(stateDelta => this.networkTraceData$.pipe(
            map(networkTraceData => {
              (networkTraceData as any)._precomputedLayout = true;
              this.applyPropertyObject(view.nodes, networkTraceData.nodes);
              this.applyPropertyObject(view.links, networkTraceData.links);
              // @ts-ignore
              const layout = new CustomisedSankeyLayoutService();
              layout.computeNodeLinks(networkTraceData);
              return networkTraceData;
            })
          ))
        )
      )
    ).toPromise();
  }

  linkGraph(data) {
    return combineLatest([this.nodeValueAccessor$, this.linkValueAccessor$, this.prescaler$]).pipe(
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
            n._fixedValue = prescaler(n._fixedValue);
            return Math.min(m, n._fixedValue);
          }
          return m;
        }, 0);
        minValue = data.links.reduce((m, l) => {
          l._value = prescaler(l._value);
          if (l._multiple_values) {
            l._multiple_values = l._multiple_values.map(prescaler) as [number, number];
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

  patchState(statePatch: Partial<SankeyState>) {
    return this.stateDelta$.pipe(
      first(),
      map(currentState =>
        this.stateDelta$.next({
          ...currentState,
          ...statePatch,
        })
      )
    );
  }

  selectPredefinedValueAccessor(predefinedValueAccessorId: string) {
    return this.options$.pipe(
      switchMap(options => this.patchState(
        this.predefinedValueAccessorReducer(options, {predefinedValueAccessorId})
      ))
    ).toPromise();
  }

  selectNetworkTrace(networkTraceIdx: number) {
    return this.data$.pipe(
      switchMap(data =>
        this.options$.pipe(
          switchMap(options =>
            this.stateDelta$.pipe(
              first(),
              map(({viewName, baseViewName, ...prevStateDelta}) => this.stateDelta$.next({
                  ...prevStateDelta,
                  ...this.defaultPredefinedValueAccessorReducer(options, {networkTraceIdx}),
                  networkTraceIdx,
                  baseViewName: SankeyViewComponent.getDefaultViewBase(data, networkTraceIdx),
                })
              )
            )
          )
        )
      )
    );
  }

  loadData(data: SankeyData) {
    this.preprocessData(data);
    this.data$.next(data);
    const options = this.extractOptionsFromGraph(data);
    this.options$.next(options);
    return of(true);
  }

  simpleAccessor(optionProperty: keyof SankeyOptions, stateProperty: keyof SankeyState) {
    return this.options$.pipe(
      map(options => options[optionProperty]),
      switchMap(option => this.state$.pipe(
        map(state => option[state[stateProperty] as string])
      ))
    );
  }

  resetOptions() {
    return this.defaultOptions$.pipe(
      first(),
      map(options => this.options$.next(options))
    ).toPromise();
  }

  resetState() {
    this.stateDelta$.next({});
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

  predefinedValueAccessorReducer({predefinedValueAccessors}, {predefinedValueAccessorId}) {
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

  defaultPredefinedValueAccessorReducer({networkTraces, predefinedValueAccessors}, {networkTraceIdx}) {
    const predefinedValueAccessorId = networkTraces[networkTraceIdx]?.default_sizing;
    return this.predefinedValueAccessorReducer({predefinedValueAccessors}, {predefinedValueAccessorId});
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
            };
          } else if (Array.isArray(v) && v.length === 2 && isPositiveNumber(v[0]) && isPositiveNumber(v[1])) {
            linkValueAccessors[k] = {
              description: k,
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
            description: k,
            preprocessing: nodeValues.byProperty(k)
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
      switchMap(data => this.loadData(data))
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
    this.resetOptions();
    this.resetState();
    this.extractOptionsFromGraph(content);
  }

  computeGraph(stateUpdate?: Partial<SankeyState>) {
    // todo
    // Object.assign(this.state, stateUpdate);
    this.applyState();
  }
}
