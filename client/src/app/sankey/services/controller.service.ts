import { Injectable } from '@angular/core';

import { of, Subject, iif, throwError, ReplaySubject, merge as rx_merge, Observable, combineLatest } from 'rxjs';
import { merge, transform, cloneDeepWith, clone, max, flatMap, pick, isEqual, uniq, isNil, omit } from 'lodash-es';
import { switchMap, map, filter, catchError, first, shareReplay, distinctUntilChanged, publish, startWith, pairwise } from 'rxjs/operators';

import { GraphPredefinedSizing, GraphNode, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import {
  SankeyData,
  SankeyTraceNetwork,
  SankeyPathReportEntity,
  SankeyState,
  LINK_VALUE_GENERATOR,
  NODE_VALUE_GENERATOR,
  PREDEFINED_VALUE,
  SankeyFileOptions,
  SankeyView,
  SankeyStaticOptions,
  ViewBase,
  Prescaler,
  LINK_PROPERTY_GENERATORS,
  SankeyViews,
  SankeyLink,
  SankeyId,
  SankeyTrace,
  SankeyNode,
  SankeyOptions,
  MultiValueAccessor
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { debug } from 'app/shared/rxjs/debug';

import { prescalers, PRESCALER_ID } from '../algorithms/prescalers';
import { isPositiveNumber, indexByProperty } from '../utils/utils';
import { LayoutService } from './layout.service';
import { unifiedSingularAccessor } from '../utils/rxjs';
import { StateControlAbstractService } from '../abstract/state-control.service';
import { getBaseState, getCommonState } from '../utils/stateLevels';
import { ErrorMessages, NotImplemented } from '../error';

export const customisedMultiValueAccessorId = 'Customised';

export const customisedMultiValueAccessor = {
  description: customisedMultiValueAccessorId
} as MultiValueAccessor;

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
export class ControllerService extends StateControlAbstractService<SankeyOptions, SankeyState> {
  constructor(
    readonly warningController: WarningControllerService
  ) {
    super();
  }

  delta$ = new ReplaySubject<Partial<SankeyState>>(1);
  data$ = new ReplaySubject<SankeyData>(1);
  baseView$: Observable<{ baseViewName: string, baseViewInitState: object }>;

  state$ = this.delta$.pipe(
    publish(delta$ =>
      combineLatest([
        of({
          normalizeLinks: false,
          prescalerId: PRESCALER_ID.none,
          labelEllipsis: {
            enabled: true,
            value: LayoutService.labelEllipsis
          },
          fontSizeScale: 1.0
        }),
        delta$,
        this.resolveNetworkTraceAndBaseView(delta$),
        this.resolveView(delta$)
      ])
    ),
    map((deltas) => merge({}, ...deltas)),
    distinctUntilChanged(isEqual),
    debug('state$'),
    shareReplay(1)
  );
  networkTraceIdx$ = this.stateAccessor('networkTraceIdx');
  baseViewName$ = this.stateAccessor('baseViewName');
  // do not use standart accessor for this one cause we want null if it wasnt set
  viewName$ = this.state$.pipe(
    map(({viewName = null}) => viewName),
    distinctUntilChanged()
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

  networkTraces$ = unifiedSingularAccessor(this.options$, 'networkTraces');

  viewsUpdate$: Subject<SankeyViews> = new Subject<SankeyViews>();
  fontSizeScale$ = this.stateAccessor('fontSizeScale');

  views$ = rx_merge(
    this.data$.pipe(map(({_views = {}}) => _views)),
    this.viewsUpdate$
  ).pipe(
    debug('views$'),
    shareReplay<SankeyViews>(1)
  );

  /**
   * Returns active view or null if no view is active
   */
  view$ = this.views$.pipe(
    switchMap(views => this.viewName$.pipe(
      map(viewName => views[viewName] ?? null),
    )),
    distinctUntilChanged(),
    debug('view'),
    shareReplay<SankeyView>(1)
  );

  labelEllipsis$ = this.stateAccessor('labelEllipsis');

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
      map(({links, nodes, graph: {node_sets}}) => {
        return ({
          links,
          nodes,
          traces,
          sources: node_sets[sources],
          targets: node_sets[targets]
        });
      })
    )),
    debug('partialNetworkTraceData$'),
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
          const traceNodes = this.getNetworkTraceNodes(traceLinks, nodes).map(clone);

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
            map(({graph: {trace_networks, node_sets}}) => {
              const {sources: sourcesSetId, targets: targetsNameId} = trace_networks[networkTraceIdx];
              const sources = node_sets[sourcesSetId];
              const targets = node_sets[targetsNameId];
              return {
                networkTraceIdx,
                baseViewName: sources.length > 1 && targets.length > 1 ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane
              };
            })
          )
        )
      )
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
            map(view => merge(
              {
                baseViewName: view.base,
                baseViewInitState: getBaseState(view.state),
              },
              getCommonState(view.state),
              // if there was no change of view name allow for the view to be updated
              (previousDelta.viewName === delta.viewName ? omit(delta, 'baseViewName') : {})
            ))
          )
        )
      )
    );
  }

  selectNetworkTrace(networkTraceIdx: number) {
    return this.patchState({
      networkTraceIdx,
      baseViewName: null,
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
    throw new NotImplemented();
  }

  /**
   * Helper to create Map for fast lookup
   */
  getNodeById<T extends { _id: SankeyId }>(nodes: T[]) {
    return indexByProperty(nodes, '_id');
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

    return uniq(
      flatMap(networkTraceLinks, ({source, target}) => [source, target])
    ).reduce((nodes, id) => {
      // map, filter, warn on one intteration
      const node = nodeById.get(id);
      if (!node) {
        this.warningController.warn(ErrorMessages.missingNode(id));
      } else {
        nodes.push(node);
      }
      return nodes;
    }, []);
  }

  computeData(): SankeyData {
    throw new NotImplemented();
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
  getRelatedTraces({nodes, links}): SankeyTrace[] {
    // check nodes links for traces which are coming in and out
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {_sourceLinks, _targetLinks}) =>
        linksAccumulator.concat(_sourceLinks, _targetLinks)
      , []
    );
    // add links traces and reduce to unique values
    return uniq(flatMap(nodesLinks.concat([...links]), '_traces'));
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
    this.extractOptionsFromGraph(content);
  }
}
