import { Injectable } from '@angular/core';

import { switchMap, map } from 'rxjs/operators';

import { ValueGenerator, SankeyTraceNetwork, SankeyLink, LINK_VALUE_GENERATOR, ViewBase, PREDEFINED_VALUE } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION, christianColors, linkPalettes } from '../color-palette';
import { SankeyBaseViewControllerService } from '../../../services/sankey-base-view-controller.service';
import { inputCount } from '../algorithms/linkValues';
import { SankeyMultiLaneOptions, SankeyMultiLaneState } from '../interfaces';
import { SankeyControllerService } from '../../../services/sankey-controller.service';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SankeyMultiLaneControllerService extends SankeyBaseViewControllerService<SankeyMultiLaneOptions, SankeyMultiLaneState> {
  constructor(
    readonly c: SankeyControllerService,
    readonly warningController: WarningControllerService
  ) {
    super(c, warningController);
    this.initCommonObservables();
    this.state$.subscribe(s => console.log('SankeySingleLaneControllerService state$', s));
    this.dataToRender$.subscribe(d => console.log('data to render', d));
    this.networkTraceData$.subscribe(d => console.log('SankeySingleLaneControllerService networkTraceData$', d));
    this.defaultState$.subscribe(d => console.log('defaultState$ construct subscription', d));
    this.nodeValueAccessor$.subscribe(d => console.log('nodeValueAccessor$ construct subscription', d));
    this.linkValueAccessor$.subscribe(d => console.log('linkValueAccessor$ construct subscription', d));
    this.predefinedValueAccessor$.subscribe(d => console.log('predefinedValueAccessor$ construct subscription', d));
    this.defaultState$.subscribe(d => console.log('defaultState$ construct subscription', d));
    this.state$.subscribe(d => console.log('state$ construct subscription', d));
    this.options$.subscribe(d => console.log('options$ construct subscription', d));
  }

  baseDefaultState = Object.freeze({
    predefinedValueAccessorId: PREDEFINED_VALUE.input_count,
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
    linkPaletteId: 'default'
  });

  baseDefaultOptions = Object.freeze({
    linkPalettes,
    linkValueGenerators: {
      [LINK_VALUE_GENERATOR.input_count]: {
        description: LINK_VALUE_GENERATOR.input_count,
        preprocessing: inputCount,
        disabled: () => false
      } as ValueGenerator
    }
  });

  viewBase = ViewBase.sankeyMultiLane;


  private excludedProperties = new Set(['source', 'target', 'dbId', 'id', 'node', '_id']);

  palette$ = this.options$.pipe(
    switchMap(({linkPalettes}) =>
      this.state$.pipe(
        map(({linkPaletteId}) => linkPalettes[linkPaletteId])
      )
    )
  );

  networkTraceData$ = this.c.partialNetworkTraceData$.pipe(
    switchMap(({links, nodes, traces, ...rest}) => this.palette$.pipe(
      map(palette => {
        const traceColorPaletteMap = createMapToColor(
          traces.map(({_group}) => _group),
          {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
          palette
        );
        const networkTraceLinks = this.getAndColorNetworkTraceLinks(traces, links, traceColorPaletteMap);
        const networkTraceNodes = this.c.getNetworkTraceNodes(networkTraceLinks, nodes);
        this.colorNodes(networkTraceNodes);
        return {
          nodes: networkTraceNodes,
          links: networkTraceLinks,
          ...rest
        };
      })
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
    traces: SankeyTraceNetwork['traces'],
    links: ReadonlyArray<Readonly<SankeyLink>>,
    colorMap?
  ) {
    const traceBasedLinkSplitMap = new Map();
    const traceGroupColorMap = colorMap ?? new Map(
      traces.map(({_group}) => [_group, christianColors[_group]])
    );
    const networkTraceLinks = traces.reduce((o, trace, traceIdx) => {
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
