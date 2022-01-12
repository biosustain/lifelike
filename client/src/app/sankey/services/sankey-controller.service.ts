import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { merge, omit, transform, cloneDeepWith, clone, isNil, max } from 'lodash-es';

import { GraphPredefinedSizing, GraphNode, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import {
  SankeyOptions,
  ValueGenerator,
  SankeyData,
  SankeyTraceNetwork,
  SankeyLink,
  SankeyNode,
  SankeyPathReport,
  SankeyPathReportEntity,
  SankeyId,
  SankeyState,
  LINK_VALUE_GENERATOR,
  NODE_VALUE_GENERATOR,
  PREDEFINED_VALUE,
  ViewBase
} from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import * as linkValues from '../algorithms/linkValues';
import * as nodeValues from '../algorithms/nodeValues';
import { prescalers, PRESCALER_ID } from '../algorithms/prescalers';
import { isPositiveNumber } from '../utils';

export const customisedMultiValueAccessorId = 'Customised';

export const customisedMultiValueAccessor = {
  description: customisedMultiValueAccessorId
} as ValueGenerator;


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
    this.resetOptions();
    this.resetState();
  }

  viewBase = ViewBase.sankeyMultiLane;

  get defaultOptions(): SankeyOptions {
    return {
      networkTraces: [],
      linkValueAccessors: {},
      nodeValueAccessors: {},
      predefinedValueAccessors: {
        [PREDEFINED_VALUE.fixed_height]: {
          description: PREDEFINED_VALUE.fixed_height,
          callback: () => {
            this.state.linkValueAccessorId = LINK_VALUE_GENERATOR.fixedValue1;
            this.state.nodeValueAccessorId = NODE_VALUE_GENERATOR.none;
          }
        },
        [PREDEFINED_VALUE.input_count]: {
          description: PREDEFINED_VALUE.input_count,
          callback: () => {
            this.state.linkValueAccessorId = LINK_VALUE_GENERATOR.input_count;
            this.state.nodeValueAccessorId = NODE_VALUE_GENERATOR.none;
          }
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
          disabled: () => this.state.nodeValueAccessorId === NODE_VALUE_GENERATOR.none,
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
    };
  }

  get defaultState(): Partial<SankeyState> {
    return {
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
    };
  }

  allData: BehaviorSubject<SankeyData> = new BehaviorSubject(undefined);
  dataToRender = new BehaviorSubject(undefined);

  options: SankeyOptions;
  state: Partial<SankeyState>;

  get nodeValueAccessor() {
    const valueAccessor = (
      this.options.nodeValueGenerators[this.state.nodeValueAccessorId] ??
      this.options.nodeValueAccessors[this.state.nodeValueAccessorId]
    );
    if (valueAccessor) {
      return valueAccessor;
    } else {
      this.warningController.warn(`Node values accessor ${this.state.nodeValueAccessorId} could not be found`);
      return this.options.nodeValueGenerators[NODE_VALUE_GENERATOR.none];
    }
  }

  get linkValueAccessor() {
    const valueAccessor = (
      this.options.linkValueGenerators[this.state.linkValueAccessorId] ??
      this.options.linkValueAccessors[this.state.linkValueAccessorId]
    );
    if (valueAccessor) {
      return valueAccessor;
    } else {
      this.warningController.warn(`Link values accessor ${this.state.nodeValueAccessorId} could not be found`);
      return this.options.linkValueGenerators[LINK_VALUE_GENERATOR.fixedValue1];
    }
  }

  get predefinedValueAccessor() {
    const {state: {predefinedValueAccessorId}} = this;
    if (predefinedValueAccessorId === customisedMultiValueAccessorId) {
      return customisedMultiValueAccessor;
    }
    return this.options.predefinedValueAccessors[this.state.predefinedValueAccessorId];
  }

  get prescaler() {
    return this.options.prescalers[this.state.prescalerId];
  }

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', '_id']);

  get selectedNetworkTrace(): SankeyTraceNetwork | undefined {
    return this.options.networkTraces[
      this.state.networkTraceIdx
      ];
  }

  get oneToMany() {
    const {graph: {node_sets}} = this.allData.value;
    const {selectedNetworkTrace} = this;
    const _inNodes = node_sets[selectedNetworkTrace.sources];
    const _outNodes = node_sets[selectedNetworkTrace.targets];
    return Math.min(_inNodes.length, _outNodes.length) === 1;
  }

  resetOptions() {
    this.options = this.defaultOptions;
  }

  resetState() {
    this.state = this.defaultState;
    this.state.linkValueAccessorId = LINK_VALUE_GENERATOR.fixedValue0;
    this.state.nodeValueAccessorId = NODE_VALUE_GENERATOR.fixedValue1;
    this.state.predefinedValueAccessorId = PREDEFINED_VALUE.fixed_height;
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

  getPathReports() {
    const {nodes, links, graph} = this.allData.value;
    const pathReports: SankeyPathReport = {};
    graph.trace_networks.forEach(traceNetwork => {
      pathReports[traceNetwork.description] = traceNetwork.traces.map(trace => {
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
      });
    });
    return pathReports;
  }

  /**
   * Color nodes in gray scale based on group they are relating to.
   */
  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
    throw new Error('Method not implemented.');
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
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
  }


  getNetworkTraceDefaultSizing(networkTrace: SankeyTraceNetwork): PREDEFINED_VALUE | string {
    if (networkTrace) {
      let {default_sizing} = networkTrace;
      if (default_sizing && !this.options.predefinedValueAccessors[default_sizing]) {
        this.warningController.warn(`Trace network default sizing preset ${default_sizing} could not be found among value accessors`);
        default_sizing = undefined;
      }
      return default_sizing ?? (
        this.oneToMany ? PREDEFINED_VALUE.input_count : PREDEFINED_VALUE.fixed_height
      );
    }
  }

  setPredefinedValueAccessor() {
    const predefinedValueAccessorId = this.getNetworkTraceDefaultSizing(this.selectedNetworkTrace);
    if (predefinedValueAccessorId) {
      this.state.predefinedValueAccessorId = predefinedValueAccessorId;
      this.predefinedValueAccessor.callback();
    }
  }

  computeData(): SankeyData {
    throw new Error('Not implemented');
  }

  applyState() {
    this.dataToRender.next(
      this.computeData()
    );
  }

  // region Extract options
  private extractLinkValueProperties({links: sankeyLinks, graph: {sizing}}) {
    const predefinedPropertiesToFind = new Set(Object.values(sizing ?? {}).map(({link_sizing}) => link_sizing));
    // extract all numeric properties
    for (const link of sankeyLinks) {
      for (const [k, v] of Object.entries(link)) {
        if (!this.options.linkValueAccessors[k] && !this.excludedProperties.has(k)) {
          if (isPositiveNumber(v)) {
            this.options.linkValueAccessors[k] = {
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
            this.options.linkValueAccessors[k] = {
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
        return;
      }
    }
    this.warningController.warn(`Predefined link value accessor accesses not existing properties: ${[...predefinedPropertiesToFind]}`);
  }

  private extractNodeValueProperties({nodes: sankeyNodes, graph: {sizing}}) {
    const predefinedPropertiesToFind = new Set(Object.values(sizing ?? {}).map(({node_sizing}) => node_sizing));
    // extract all numeric properties
    for (const node of sankeyNodes) {
      for (const [k, v] of Object.entries(node)) {
        if (!this.options.nodeValueAccessors[k] && isPositiveNumber(v) && !this.excludedProperties.has(k)) {
          this.options.nodeValueAccessors[k] = {
            description: k,
            preprocessing: nodeValues.byProperty(k)
          };
          predefinedPropertiesToFind.delete(k);
        }
      }
      if (!predefinedPropertiesToFind.size) {
        return;
      }
    }
    this.warningController.warn(`Predefined node value accessor accesses not existing properties: ${[...predefinedPropertiesToFind]}`);
  }

  private extractPredefinedValueProperties({sizing = {}}: { sizing: GraphPredefinedSizing }) {
    const {options: {predefinedValueAccessors}} = this;
    Object.entries(sizing).forEach(([name, {node_sizing, link_sizing}]) => {
      predefinedValueAccessors[name] = {
        description: name,
        callback: () => {
          const {
            state
          } = this;
          if (node_sizing) {
            state.nodeValueAccessorId = node_sizing;
          } else {
            state.nodeValueAccessorId = NODE_VALUE_GENERATOR.none;
          }
          if (link_sizing) {
            state.linkValueAccessorId = link_sizing;
          } else {
            state.linkValueAccessorId = LINK_VALUE_GENERATOR.fraction_of_fixed_node_value;
          }
        }
      };
    });
  }

  private extractOptionsFromGraph({links, graph, nodes}) {
    this.options.networkTraces = graph.trace_networks;
    this.extractPredefinedValueProperties(graph);
    this.extractLinkValueProperties({links, graph});
    this.extractNodeValueProperties({nodes, graph});
    this.setPredefinedValueAccessor();
  }

  // endregion

  resetController() {
    this.load(this.allData.value);
    this.computeGraph();
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
    this.allData.next(
      transform(content, (result, value, key) => {
        // only views are editable
        if (key === '_views') {
          result[key] = value;
        } else {
          result[key] = cloneDeepWith(value, Object.freeze);
        }
      }, {}) as SankeyData
    );
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
    Object.assign(this.state, stateUpdate);
    this.applyState();
  }

  linkGraph(data) {
    const preprocessedNodes = this.nodeValueAccessor.preprocessing.call(this, data) ?? {};
    const preprocessedLinks = this.linkValueAccessor.preprocessing.call(this, data) ?? {};

    Object.assign(
      data,
      preprocessedLinks,
      preprocessedNodes,
      merge(
        omit(preprocessedLinks, ['nodes', 'links']),
        omit(preprocessedNodes, ['nodes', 'links'])
      )
    );

    const prescaler = this.prescaler.fn;

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
        l._multiple_values = l._multiple_values.map(prescaler);
        return Math.min(m, ...l._multiple_values);
      }
      return Math.min(m, l._value);
    }, minValue);

    const {
      nodeValueAccessor, linkValueAccessor
    } = this;
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
          l._multiple_values = l._multiple_values.map(v => v - minValue);
        }
      });
    }

    return data;
  }
}
