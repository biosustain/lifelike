import { Injectable } from '@angular/core';
import { SankeyTraceNetwork, SankeyLink } from '../../sankey-viewer/components/interfaces';
import { SankeyControllerService, PREDEFINED_VALUE } from '../../sankey-viewer/services/sankey-controller.service';
import { SankeyManyToManyAdvancedOptions } from '../components/interfaces';

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
    return Object.assign(super.defaultOptions, {
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
      }
    });
  }

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
