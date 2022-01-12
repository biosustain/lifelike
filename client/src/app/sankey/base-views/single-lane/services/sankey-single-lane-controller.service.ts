import { Injectable } from '@angular/core';

import { flatMap, groupBy, merge, intersection } from 'lodash-es';

import {
  LINK_VALUE_GENERATOR,
  ValueGenerator,
  SankeyTraceNetwork,
  SankeyLink,
  SankeyTrace,
  ViewBase
} from 'app/sankey/interfaces';
import EdgeColorCodes from 'app/shared/styles/EdgeColorCode';
import { RecursivePartial } from 'app/shared/schemas/common';

import {
  SankeySingleLaneLink,
  SankeySingleLaneState,
  SankeySingleLaneOptions,
  SankeySingleLaneNode,
  SankeySingleLaneOptionsExtend,
  SankeySingleLaneStateExtend
} from '../components/interfaces';
import * as linkValues from '../components/algorithms/linkValues';
import { nodeColors, NodePosition } from '../utils/nodeColors';
import { SankeyBaseViewControllerService } from '../../../services/sankey-base-view-controller.service';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeySingleLaneControllerService extends SankeyBaseViewControllerService {
  viewBase = ViewBase.sankeySingleLane;

  // @ts-ignore
  get defaultState(): SankeySingleLaneState {
    return merge(super.defaultState, {
      highlightCircular: true,
      colorLinkByType: false,
      nodeHeight: {
        min: {
          enabled: true,
          value: 4
        },
        max: {
          enabled: true,
          ratio: 2
        }
      }
    } as SankeySingleLaneStateExtend & RecursivePartial<SankeySingleLaneState>);
  }

  get defaultOptions(): SankeySingleLaneOptions {
    return merge(super.defaultOptions, {
      colorLinkTypes: EdgeColorCodes,
      linkValueGenerators: {
        [LINK_VALUE_GENERATOR.input_count]: {
          description: LINK_VALUE_GENERATOR.input_count,
          preprocessing: linkValues.inputCount,
          disabled: () => false
        } as ValueGenerator
      }
    } as SankeySingleLaneOptionsExtend & RecursivePartial<SankeySingleLaneOptions>);
  }

  // @ts-ignore
  options: SankeySingleLaneOptions;
  // @ts-ignore
  state: SankeySingleLaneState;

  // Trace logic
  /**
   * Extract links which relates to certain trace network.
   */
  getNetworkTraceLinks(
    networkTrace: SankeyTraceNetwork,
    links: Array<SankeyLink>
  ): SankeySingleLaneLink[] {
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
    return new Set(flatMap(nodesLinks.concat([...links]), '_traces')) as Set<SankeyTrace>;
  }

  colorLinkByType(links) {
    links.forEach(link => {
      const {label} = link;
      if (label) {
        const color = EdgeColorCodes[label.toLowerCase()];
        if (color) {
          link._color = color;
        } else {
          this.warningController.warn(`There is no color mapping for label: ${label}`);
        }
      }
    });
  }

  get sourcesIds() {
    return this.allData.value.graph.node_sets[
      this.selectedNetworkTrace.sources
      ];
  }

  get targetsIds() {
    return this.allData.value.graph.node_sets[
      this.selectedNetworkTrace.targets
      ];
  }

  /**
   * Color nodes if they are in source or target set.
   */
  // @ts-ignore
  colorNodes(nodes, sourcesIds: number[], targetsIds: number[]) {
    nodes.forEach(node => node._color = undefined);
    const nodeById = new Map<number, SankeySingleLaneNode>(nodes.map(node => [node.id, node]));
    const mapNodePositionToColor = (ids: number[], position: NodePosition) =>
      ids.forEach(id => {
        const node = nodeById.get(id);
        if (node) {
          node._color = nodeColors.get(position);
        } else {
          this.warningController.warn(`ID ${id} could not be mapped to node - inconsistent file`, true);
        }
      });
    mapNodePositionToColor(sourcesIds, NodePosition.left);
    mapNodePositionToColor(targetsIds, NodePosition.right);
    const reusedIds = intersection(sourcesIds, targetsIds);
    if (reusedIds.length) {
      this.warningController.warn(`Nodes set to be both in and out ${reusedIds}`);
      mapNodePositionToColor(reusedIds, NodePosition.multi);
    }
  }

  computeData() {
    const {selectedNetworkTrace, state: {colorLinkByType}} = this;
    const {links, nodes, graph: {node_sets}} = this.allData.value;
    const networkTraceLinks = this.getNetworkTraceLinks(selectedNetworkTrace, links);
    const networkTraceNodes = this.getNetworkTraceNodes(networkTraceLinks, nodes);
    if (colorLinkByType) {
      this.colorLinkByType(networkTraceLinks);
    }
    const _inNodes = node_sets[selectedNetworkTrace.sources];
    const _outNodes = node_sets[selectedNetworkTrace.targets];
    this.colorNodes(networkTraceNodes, _inNodes, _outNodes);
    this.state.nodeAlign = _inNodes.length > _outNodes.length ? 'right' : 'left';
    return this.linkGraph({
      nodes: networkTraceNodes,
      links: networkTraceLinks,
      _inNodes, _outNodes
    });
  }
}
