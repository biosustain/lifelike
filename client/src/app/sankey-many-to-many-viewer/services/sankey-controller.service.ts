import { Injectable } from '@angular/core';
import { ValueGenerator, SankeyTraceNetwork, SankeyLink, SankeyNode } from '../../sankey-viewer/components/interfaces';
import { SankeyManyToManyAdvancedOptions } from '../components/interfaces';
import * as linkValues from '../../sankey-viewer/components/algorithms/linkValues';
import * as nodeValues from '../../sankey-viewer/components/algorithms/nodeValues';
import prescalers from '../../sankey-viewer/components/algorithms/prescalers';
import { linkPalettes } from '../../sankey-viewer/components/color-palette';
import { SankeyLayoutService } from '../../sankey-viewer/components/sankey/sankey-layout.service';
import { SankeyControllerService, PREDEFINED_VALUE, LINK_VALUE, NODE_VALUE } from '../../sankey-viewer/services/sankey-controller.service';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeyManyToManyControllerService extends SankeyControllerService {
  options: SankeyManyToManyAdvancedOptions = {
    highlightCircular: true,
    nodeHeight: {
      min: {
        enabled: false,
        value: 0
      },
      max: {
        enabled: true,
        ratio: 10
      }
    },
    normalizeLinks: false,
    linkValueAccessors: [],
    nodeValueAccessors: [],
    predefinedValueAccessors: [
      {
        description: PREDEFINED_VALUE.fixed_height,
        callback: () => {
          this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.fixedValue1;
          this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators.none;
        }
      },
      {
        description: PREDEFINED_VALUE.input_count,
        callback: () => {
          this.options.selectedLinkValueAccessor = this.options.linkValueGenerators.input_count;
          this.options.selectedNodeValueAccessor = this.options.nodeValueGenerators.none;
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

  // Trace logic
  /**
   * Extract links which relates to certain trace network and
   * assign _color property based on their trace.
   * Also creates duplicates if given link is used in multiple traces.
   */
  getNetworkTraceLinks(
    networkTrace: SankeyTraceNetwork,
    links: Array<SankeyLink>
  ) {
    const traceBasedLinkSplitMap = new Map();
    const networkTraceLinks = networkTrace.traces.reduce((o, trace) => {
      return o.concat(
        trace.edges.map(linkIdx => {
          const originLink = links[linkIdx];
          const link = {
            ...originLink,
            _trace: trace
          };
          link._id += trace.group;
          let adjacentLinks = traceBasedLinkSplitMap.get(originLink);
          if (!adjacentLinks) {
            adjacentLinks = [];
            traceBasedLinkSplitMap.set(originLink, adjacentLinks);
          }
          adjacentLinks.push(link);
          return link;
        })
      );
    }, []);
    for (const adjacentLinkGroup of traceBasedLinkSplitMap.values()) {
      const adjacentLinkGroupLength = adjacentLinkGroup.length;
      // normalise only if multiple (skip /1)
      if (adjacentLinkGroupLength) {
        adjacentLinkGroup.forEach(l => {
          l._adjacent_divider = adjacentLinkGroupLength;
        });
      }
    }
    return networkTraceLinks;
  }


  getNetworkTraceDefaultSizing(networkTrace) {
    let {default_sizing} = networkTrace;
    if (!default_sizing) {
      if (this.oneToMany) {
        default_sizing = PREDEFINED_VALUE.input_count;
      } else {
        default_sizing = PREDEFINED_VALUE.fixed_height;
      }
    }
    return this.options.predefinedValueAccessors
      .find(({description}) => description === default_sizing);
  }

  applyOptions() {
    const {selectedNetworkTrace} = this;
    const {links, nodes, graph: {node_sets}} = this.allData;
    const networkTraceLinks = this.getNetworkTraceLinks(selectedNetworkTrace, links);
    const networkTraceNodes = this.getNetworkTraceNodes(networkTraceLinks, nodes);
    const _inNodes = node_sets[selectedNetworkTrace.sources];
    const _outNodes = node_sets[selectedNetworkTrace.targets];
    this.nodeAlign = _inNodes.length > _outNodes.length ? 'right' : 'left';
    this.dataToRender.next(
      this.linkGraph({
        nodes: networkTraceNodes,
        links: networkTraceLinks,
        _inNodes, _outNodes
      })
    );
  }
}
