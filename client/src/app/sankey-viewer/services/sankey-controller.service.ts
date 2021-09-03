import { Injectable } from '@angular/core';
import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';

import { SankeyAdvancedOptions, ValueGenerator } from '../components/interfaces';
import * as linkValues from '../components/algorithms/linkValues';
import * as nodeValues from '../components/algorithms/nodeValues';
import prescalers from '../components/algorithms/prescalers';
import { linkPalettes, createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION } from '../components/color-palette';
import { uuidv4 } from '../../shared/utils';
import { isPositiveNumber } from '../components/utils';
import { CustomisedSankeyLayoutService } from './customised-sankey-layout.service';
import { ReplaySubject, BehaviorSubject } from 'rxjs';

const LINK_VALUE = {
  fixedValue0: 'Fixed Value = 0',
  fixedValue1: 'Fixed Value = 1',
  input_count: 'Input count',
  fraction_of_fixed_node_value: 'Fraction of fixed node value',
};
const NODE_VALUE = {
  none: 'None',
  fixedValue1: 'Fixed Value = 1'
};
const PREDEFINED_VALUE = {
  default: 'Default',
  input_count: LINK_VALUE.input_count
};

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
    private sankeyLayout: CustomisedSankeyLayoutService
  ) {
    this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.fixedValue0;
    this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators.fixedValue1;
    this.options.selectedPredefinedValueAccessor = this.options.predefinedValueAccessors[0];
    this.options.selectedLinkPalette = this.options.linkPalettes.default;
  }

  get getRelatedTraces() {
    return this.sankeyLayout.getRelatedTraces;
  }

  allData: SankeyData;
  dataToRender = new BehaviorSubject(undefined);
  networkTraces;

  options: SankeyAdvancedOptions = {
    nodeHeight: {
      min: {
        enabled: false,
        value: 0
      },
      max: {
        enabled: false,
        ratio: 10
      }
    },
    normalizeLinks: false,
    linkValueAccessors: [],
    nodeValueAccessors: [],
    predefinedValueAccessors: [
      {
        description: PREDEFINED_VALUE.default,
        callback: () => {
          this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.fixedValue0;
          this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators.fixedValue1;
          this.optionsChange();
        }
      },
      {
        description: PREDEFINED_VALUE.input_count,
        callback: () => {
          this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.input_count;
          this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators.none;
          this.optionsChange();
        }
      }],
    linkValueGenerators: {
      input_count: {
        description: LINK_VALUE.input_count,
        preprocessing: linkValues.inputCount,
        disabled: () => false
      } as ValueGenerator,
      fixedValue0: {
        description: LINK_VALUE.fixedValue0,
        preprocessing: linkValues.fixedValue(0),
        disabled: () => false
      } as ValueGenerator,
      fixedValue1: {
        description: LINK_VALUE.fixedValue1,
        preprocessing: linkValues.fixedValue(1),
        disabled: () => false
      } as ValueGenerator,
      fraction_of_fixed_node_value: {
        description: LINK_VALUE.fraction_of_fixed_node_value,
        disabled: () => this.options.selectedNodeValueAccessor === this.options.nodeValueGenerators.none,
        requires: ({node}) => node.fixedValue,
        preprocessing: linkValues.fractionOfFixedNodeValue
      } as ValueGenerator
    },
    nodeValueGenerators: {
      none: {
        description: NODE_VALUE.none,
        preprocessing: nodeValues.noneNodeValue,
        disabled: () => false
      } as ValueGenerator,
      fixedValue1: {
        description: NODE_VALUE.fixedValue1,
        preprocessing: nodeValues.fixedValue(1),
        disabled: () => false
      } as ValueGenerator
    },
    selectedLinkValueAccessor: undefined,
    selectedNodeValueAccessor: undefined,
    selectedPredefinedValueAccessor: undefined,
    prescalers,
    selectedPrescaler: prescalers.default,
    linkPalettes,
    selectedLinkPalette: linkPalettes.default,
    labelEllipsis: {
      enabled: true,
      value: SankeyLayoutService.labelEllipsis
    },
    fontSizeScale: 1.0
  };

  nodeAlign;

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node']);

  selectedNetworkTrace;

  selectNetworkTrace(networkTrace) {
    this.selectedNetworkTrace = networkTrace;
    const {default_sizing} = networkTrace;
    const selectedPredefinedValueAccessor =
      this.options.predefinedValueAccessors
        .find(({description}) => description === default_sizing);
    if (selectedPredefinedValueAccessor) {
      this.options.selectedPredefinedValueAccessor = selectedPredefinedValueAccessor;
    }
    const {links, nodes, graph: {node_sets}} = this.allData;
    const {palette} = this.options.selectedLinkPalette;
    const traceColorPaletteMap = createMapToColor(
      networkTrace.traces.map(({group}) => group),
      {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
      palette
    );
    const networkTraceLinks = this.sankeyLayout.getAndColorNetworkTraceLinks(networkTrace, links, traceColorPaletteMap);
    const networkTraceNodes = this.sankeyLayout.getNetworkTraceNodes(networkTraceLinks, nodes);
    this.sankeyLayout.colorNodes(nodes);
    const _inNodes = node_sets[networkTrace.sources];
    const _outNodes = node_sets[networkTrace.targets];
    this.nodeAlign = _inNodes.length > _outNodes.length ? 'right' : 'left';
    const qn = new Map();
    networkTraceLinks.forEach(l => {
      qn.set(l.source + ' ' + l.target, l);
    });
    this.dataToRender.next(
      this.linkGraph({
        nodes: networkTraceNodes,
        links: [...qn.values()],
        _inNodes, _outNodes
      })
    );
  }

  // region Extract options
  private extractLinkValueProperties([link = {}]) {
    // extract all numeric properties
    this.options.linkValueAccessors = Object.entries(link).reduce((o, [k, v]) => {
      if (this.excludedProperties.has(k)) {
        return o;
      }
      if (isPositiveNumber(v)) {
        o.push({
          description: k,
          preprocessing: linkValues.byProperty(k),
          postprocessing: ({links}) => {
            links.forEach(l => {
              l._value /= (l._adjacent_divider || 1);
              // take max for layer calculation
            });
          }
        });
      } else if (Array.isArray(v) && v.length === 2 && isPositiveNumber(v[0]) && isPositiveNumber(v[1])) {
        o.push({
          description: k,
          preprocessing: linkValues.byArrayProperty(k),
          postprocessing: ({links}) => {
            links.forEach(l => {
              l._multiple_values = l._multiple_values.map(d => d / (l._adjacent_divider || 1));
              // take max for layer calculation
            });
          }
        });
      }
      return o;
    }, []);
  }

  private extractNodeValueProperties([node = {}]) {
    // extract all numeric properties
    this.options.nodeValueAccessors = Object.entries(node).reduce((o, [k, v]) => {
      if (this.excludedProperties.has(k)) {
        return o;
      }
      if (isPositiveNumber(v)) {
        o.push({
          description: k,
          preprocessing: nodeValues.byProperty(k)
        });
      }
      return o;
    }, []);
  }

  private extractPredefinedValueProperties({sizing = {}}: { sizing: SankeyPredefinedSizing }) {
    this.options.predefinedValueAccessors = this.options.predefinedValueAccessors.concat(
      Object.entries(sizing).map(([name, {node_sizing, link_sizing}]) => ({
        description: name,
        callback: () => {
          const {options} = this;
          const {
            nodeValueAccessors,
            nodeValueGenerators,
            linkValueAccessors,
            linkValueGenerators
          } = options;
          if (node_sizing) {
            options.selectedNodeValueAccessor = nodeValueAccessors.find(
              ({description}) => description === node_sizing
            );
          } else {
            options.selectedNodeValueAccessor = nodeValueGenerators[0];
          }
          if (link_sizing) {
            options.selectedLinkValueAccessor = linkValueAccessors.find(
              ({description}) => description === link_sizing
            );
          } else {
            options.selectedLinkValueAccessor = linkValueGenerators.fraction_of_fixed_node_value;
          }
          this.optionsChange();
        }
      })));
  }

  private extractOptionsFromGraph({links, graph, nodes, ...data}) {
    this.networkTraces = graph.trace_networks;
    this.selectedNetworkTrace = this.networkTraces[0];
    this.extractLinkValueProperties(links);
    this.extractNodeValueProperties(nodes);
    this.extractPredefinedValueProperties(graph);
  }

  // endregion

  optionsChange() {
    this.sankeyLayout.nodeHeight = {...this.options.nodeHeight};
    this.sankeyLayout.labelEllipsis = {...this.options.labelEllipsis};
    this.sankeyLayout.fontSizeScale = this.options.fontSizeScale;
    this.selectNetworkTrace(this.selectedNetworkTrace);
  }

  load(content) {
    this.extractOptionsFromGraph(content);
    this.allData = content as SankeyData;
    this.applyFilter();
  }

  private applyFilter() {
    if (this.selectedNetworkTrace) {
      this.selectNetworkTrace(this.selectedNetworkTrace);
    } else {
      this.dataToRender.next(this.allData);
    }
  }

  private linkGraph(data) {
    data.links.forEach(l => {
      l.id = uuidv4();
    });
    const preprocessedNodes = this.options.selectedNodeValueAccessor.preprocessing(data) || {};
    const preprocessedLinks = this.options.selectedLinkValueAccessor.preprocessing(data) || {};

    Object.assign(data, preprocessedLinks, preprocessedNodes);

    const prescaler = this.options.selectedPrescaler.fn;

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
    if (this.options.selectedNodeValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedNodeValueAccessor.postprocessing(data) || {});
    }
    if (this.options.selectedLinkValueAccessor.postprocessing) {
      Object.assign(data, this.options.selectedLinkValueAccessor.postprocessing(data) || {});
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
