import { Injectable, Injector } from '@angular/core';

import { switchMap, map, distinctUntilChanged } from 'rxjs/operators';
import { pick, isEqual } from 'lodash-es';
import { of } from 'rxjs';

import { SankeyTraceNetwork, SankeyLink, LINK_VALUE_GENERATOR, ViewBase, PREDEFINED_VALUE } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { BaseControllerService } from 'app/sankey/services/base-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { unifiedSingularAccessor } from 'app/sankey/utils/rxjs';

import { createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION, christianColors, linkPalettes, LINK_PALETTE_ID } from '../color-palette';
import { inputCount } from '../algorithms/linkValues';
import { BaseState, BaseOptions } from '../interfaces';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class MultiLaneBaseControllerService  extends BaseControllerService<BaseOptions, BaseState> {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super(common, warningController, injector);
    this.onInit();
    this.graphInputState$ = this.common.state$.pipe(
      map(state => pick(state, ['normalizeLinks'])),
      distinctUntilChanged(isEqual)
    );
  }

  viewBase = ViewBase.sankeyMultiLane;

  default$ = this.common.options$.pipe(
    map(({predefinedValueAccessors}) => ({
      predefinedValueAccessorId: PREDEFINED_VALUE.input_count,
      ...pick(predefinedValueAccessors[PREDEFINED_VALUE.input_count], ['nodeValueAccessorId', 'linkValueAccessorId']),
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
      linkPaletteId: LINK_PALETTE_ID.hue_palette
    }))
  );

  linkValueAccessors = {
    ...this.linkValueAccessors,
    [LINK_VALUE_GENERATOR.input_count]: {
      preprocessing: inputCount,
      disabled: () => false
    }
  };

  options$ = of(Object.freeze({
    linkPalettes
  }));

  palette$ = this.optionStateAccessor('linkPalettes', 'linkPaletteId');

  networkTraceData$ = this.common.partialNetworkTraceData$.pipe(
    switchMap(({links, nodes, traces, ...rest}) => this.palette$.pipe(
      map(({palette}) => {
        const traceColorPaletteMap = createMapToColor(
          traces.map(({_group}) => _group),
          {alpha: _ => DEFAULT_ALPHA, saturation: _ => DEFAULT_SATURATION},
          palette
        );
        const networkTraceLinks = this.getAndColorNetworkTraceLinks(traces, links, traceColorPaletteMap);
        const networkTraceNodes = this.common.getNetworkTraceNodes(networkTraceLinks, nodes);
        this.colorNodes(networkTraceNodes);
        return {
          nodes: networkTraceNodes,
          links: networkTraceLinks,
          ...rest
        };
      })
    ))
  );

  linkPalettes$ = unifiedSingularAccessor(this.options$, 'linkPalettes');

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
            _originLinkId: originLink._id,
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
