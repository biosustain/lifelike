import { Injectable } from '@angular/core';

import { flatMap, groupBy, extend, merge } from 'lodash-es';

import { SankeyTraceNetwork, SankeyLink, ValueGenerator } from '../../sankey-viewer/components/interfaces';
import { SankeyControllerService, PREDEFINED_VALUE, LINK_VALUE } from '../../sankey-viewer/services/sankey-controller.service';
import { SankeyManyToManyAdvancedOptions, SankeyManyToManyLink } from '../components/interfaces';
import * as linkValues from '../components/algorithms/linkValues';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeyManyToManyControllerService extends SankeyControllerService {
  get defaultOptions(): SankeyManyToManyAdvancedOptions {
    return merge(super.defaultOptions, {
      highlightCircular: true,
      nodeHeight: {
        max: {
          enabled: true,
          ratio: 2
        }
      },
      linkValueGenerators: {
        input_count: {
          description: LINK_VALUE.input_count,
          preprocessing: linkValues.inputCount,
          disabled: () => false
        } as ValueGenerator
      }
    });
  }

  // Trace logic
  /**
   * Extract links which relates to certain trace network.
   */
  getNetworkTraceLinks(
    networkTrace: SankeyTraceNetwork,
    links: Array<SankeyLink>
  ): SankeyManyToManyLink[] {
    const traceLink = flatMap(networkTrace.traces, trace => trace.edges.map(linkIdx => ({trace, linkIdx})));
    const linkIdxToTraceLink = groupBy(traceLink, 'linkIdx');
    return Object.entries(linkIdxToTraceLink).map(([linkIdx, wrappedTraces]) => ({
      ...links[linkIdx],
      _traces: wrappedTraces.map(({trace}) => trace)
    }));
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
    return new Set(flatMap(nodesLinks.concat([...links]), '_traces')) as Set<GraphTrace>;
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
