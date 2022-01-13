import { Injectable } from '@angular/core';

import { flatMap, groupBy, intersection } from 'lodash-es';
import { switchMap } from 'rxjs/operators';

import { LINK_VALUE_GENERATOR, ValueGenerator, SankeyTraceNetwork, SankeyLink, ViewBase } from 'app/sankey/interfaces';
import EdgeColorCodes from 'app/shared/styles/EdgeColorCode';

import { inputCount } from '../algorithms/linkValues';
import { SankeySingleLaneLink, SankeySingleLaneState, SankeySingleLaneOptions, SankeySingleLaneNode } from '../components/interfaces';
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
export class SankeySingleLaneControllerService extends SankeyBaseViewControllerService<SankeySingleLaneOptions, SankeySingleLaneState> {
  viewBase = ViewBase.sankeySingleLane;

  baseDefaultState = {
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
        };

  baseDefaultOptions = {
        colorLinkTypes: EdgeColorCodes,
        linkValueGenerators: {
          [LINK_VALUE_GENERATOR.input_count]: {
            description: LINK_VALUE_GENERATOR.input_count,
            preprocessing: inputCount,
            disabled: () => false
          } as ValueGenerator
        }
      };

  computedData$ = this.data$.pipe(
    switchMap(({links, nodes, graph: {node_sets}}) => this.options$.pipe(
      switchMap(({networkTraces}) => this.state$.pipe(
        switchMap(({networkTraceIdx, colorLinkByType}) => {
          const selectedNetworkTrace = networkTraces[networkTraceIdx];
          const networkTraceLinks = this.getNetworkTraceLinks(selectedNetworkTrace, links);
          const networkTraceNodes = this.getNetworkTraceNodes(networkTraceLinks, nodes);
          if (colorLinkByType) {
            this.colorLinkByType(networkTraceLinks);
          }
          const _inNodes = node_sets[selectedNetworkTrace.sources];
          const _outNodes = node_sets[selectedNetworkTrace.targets];
          this.colorNodes(networkTraceNodes, _inNodes, _outNodes);
          return this.linkGraph({
            nodes: networkTraceNodes,
            links: networkTraceLinks,
            _inNodes, _outNodes
          });
        })
      ))
    ))
  );

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
}
