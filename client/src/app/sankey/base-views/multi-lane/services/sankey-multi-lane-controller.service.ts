import { Injectable } from '@angular/core';

import { switchMap, map } from 'rxjs/operators';

import { ValueGenerator, SankeyTraceNetwork, SankeyLink, LINK_VALUE_GENERATOR, ViewBase } from 'app/sankey/interfaces';

import { createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION, christianColors } from '../color-palette';
import { SankeyBaseViewControllerService } from '../../../services/sankey-base-view-controller.service';
import { inputCount } from '../algorithms/linkValues';
import { SankeyMultiLaneOptions, SankeyMultiLaneState } from '../interfaces';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeyMultiLaneControllerService extends SankeyBaseViewControllerService<SankeyMultiLaneOptions, SankeyMultiLaneState> {
  viewBase = ViewBase.sankeyMultiLane;

  baseDefaultState = {
    nodeHeight: {
      min: {
        enabled: true,
        value: 1
      },
      max: {
        enabled: false,
        ratio: 10
      }
    }
  };

  baseDefaultOptions = {
    linkValueGenerators: {
      [LINK_VALUE_GENERATOR.input_count]: {
        description: LINK_VALUE_GENERATOR.input_count,
        preprocessing: inputCount,
        disabled: () => false
      } as ValueGenerator
    }
  };

  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', '_id']);

  networkTraceData$ = this.data$.pipe(
    switchMap(({links, nodes, graph: {node_sets}}) => this.options$.pipe(
      switchMap(({networkTraces, linkPalettes}) => this.state$.pipe(
        map(({networkTraceIdx, linkPaletteId}) => {
          const selectedNetworkTrace = networkTraces[networkTraceIdx];
          const palette = linkPalettes[linkPaletteId];
          const traceColorPaletteMap = createMapToColor(
            selectedNetworkTrace.traces.map(({_group}) => _group),
            {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
            palette
          );
          const networkTraceLinks = this.getAndColorNetworkTraceLinks(selectedNetworkTrace, links, traceColorPaletteMap);
          const networkTraceNodes = this.getNetworkTraceNodes(networkTraceLinks, nodes);
          const _inNodes = node_sets[selectedNetworkTrace.sources];
          const _outNodes = node_sets[selectedNetworkTrace.targets];
          this.colorNodes(networkTraceNodes);
          return {
            nodes: networkTraceNodes,
            links: networkTraceLinks,
            _inNodes, _outNodes
          };
        })
      ))
    ))
  );

  computedData$ = this.data$.pipe(
    switchMap(({links, nodes, graph: {node_sets}}) => this.options$.pipe(
      switchMap(({networkTraces, linkPalettes}) => this.state$.pipe(
        switchMap(({networkTraceIdx, linkPaletteId}) => {
          const selectedNetworkTrace = networkTraces[networkTraceIdx];
          const palette = linkPalettes[linkPaletteId];
          const traceColorPaletteMap = createMapToColor(
            selectedNetworkTrace.traces.map(({_group}) => _group),
            {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
            palette
          );
          const networkTraceLinks = this.getAndColorNetworkTraceLinks(selectedNetworkTrace, links, traceColorPaletteMap);
          const networkTraceNodes = this.getNetworkTraceNodes(networkTraceLinks, nodes);
          const _inNodes = node_sets[selectedNetworkTrace.sources];
          const _outNodes = node_sets[selectedNetworkTrace.targets];
          this.colorNodes(networkTraceNodes);
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
    const traceBasedLinkSplitMap = new Map();
    const traceGroupColorMap = colorMap ?? new Map(
      networkTrace.traces.map(({_group}) => [_group, christianColors[_group]])
    );
    const networkTraceLinks = networkTrace.traces.reduce((o, trace, traceIdx) => {
      const color = traceGroupColorMap.get(trace._group);
      trace._color = color;
      return o.concat(
        trace.edges.map(linkIdx => {
          const originLink = links[linkIdx];
          const link = {
            ...originLink,
            _color: color,
            _trace: trace,
            _order: -trace._group,
            _id: `${originLink._id}_${trace._group}_${traceIdx}`
          };
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

  /**
   * Color nodes in gray scale based on group they are relating to.
   */
  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
    // set colors for all node types
    const nodeCategories = new Set(nodes.map(nodeColorCategoryAccessor));
    const nodesColorMap = createMapToColor(
      nodeCategories,
      {
        hue: () => 0,
        lightness: (i, n) => {
          // all but not extreme (white, black)
          return (i + 1) / (n + 2);
        },
        saturation: () => 0,
        alpha: () => 0.75
      }
    );
    nodes.forEach(node => {
      node._color = nodesColorMap.get(nodeColorCategoryAccessor(node));
    });
  }
}
