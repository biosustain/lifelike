import { Injectable, Injector, OnDestroy } from '@angular/core';

import { switchMap, map, shareReplay } from 'rxjs/operators';
import { merge, isNil } from 'lodash-es';
import { of, iif, defer } from 'rxjs';

import { ViewBase } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { BaseControllerService } from 'app/sankey/services/base-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { unifiedSingularAccessor } from 'app/sankey/utils/rxjs';
import { debug } from 'app/shared/rxjs/debug';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { PREDEFINED_VALUE, LINK_VALUE_GENERATOR } from 'app/sankey/interfaces/valueAccessors';
import { SankeyLink, TraceNetwork, SankeyTraceLink, View } from 'app/sankey/model/sankey-document';

import { createMapToColor, christianColors, linkPalettes, LINK_PALETTE_ID } from '../color-palette';
import { inputCount } from '../algorithms/linkValues';
import { Base } from '../interfaces';
import { getBaseState } from '../../../utils/stateLevels';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class MultiLaneBaseControllerService extends BaseControllerService<Base> implements ServiceOnInit, OnDestroy {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super(common, warningController, injector);
    this.onInit();
  }

  viewBase = ViewBase.sankeyMultiLane;

  state$ = this.delta$.pipe(
    switchMap(delta =>
      this.common.view$.pipe(
        switchMap(view =>
          iif(
            () => !isNil(view),
            defer(() => of(getBaseState((view as View).state))),
            of({})
          )
        ),
        map(state => merge({}, state, delta))
      )
    ),
    map(delta => merge(
      {},
      {
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
        linkPaletteId: LINK_PALETTE_ID.hue_palette,
        predefinedValueAccessorId: PREDEFINED_VALUE.input_count,
      },
      delta
    )),
    switchMap(delta => this.common.options$.pipe(
        map(({predefinedValueAccessors}) =>
          this.pickPartialAccessors(predefinedValueAccessors[delta.predefinedValueAccessorId])
        ),
        map(state => merge({}, state, delta))
      )
    )
  ).pipe(
    debug('MultiLaneBaseControllerService.state$'),
    shareReplay<Base['state']>({bufferSize: 1, refCount: true})
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

  networkTraceData$ = this.common.data$.pipe(
    switchMap(({links, nodes, nodeById}) => this.common.networkTrace$.pipe(
        map((tn) => {
          const {traces, sources, targets} = tn;
          const networkTraceLinks = this.getAndColorNetworkTraceLinks(traces, links);
          const networkTraceNodes = this.common.getNetworkTraceNodes(networkTraceLinks, nodeById);
          this.colorNodes(networkTraceNodes);
          return {
            nodes: networkTraceNodes,
            links: networkTraceLinks,
            nodeById, sources, targets
          };
        }),
        debug('MultiLaneBaseControllerService.networkTraceData$'),
        shareReplay<Base['data']>(1)
      )
    )
  );

  linkPalettes$ = unifiedSingularAccessor(this.options$, 'linkPalettes');

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  // Trace logic
  /**
   * Extract links which relates to certain trace network and
   * assign color property based on their trace.
   * Also creates duplicates if given link is used in multiple traces.
   * Should return copy of link Objects (do not mutate links!)
   */
  getAndColorNetworkTraceLinks(
    traces: TraceNetwork['traces'],
    links: ReadonlyArray<Readonly<SankeyLink>>,
    colorMap?
  ) {
    const traceBasedLinkSplitMap = new Map();
    const traceGroupColorMap = colorMap ?? new Map(
      traces.map(({group}) => [group, christianColors[group]])
    );
    const networkTraceLinks = traces.reduce((o, trace, traceIdx) => {
      const color = traceGroupColorMap.get(trace.group);
      trace.color = color;
      return o.concat(
        trace.edges.map(linkIdx => {
          const originLink = links[linkIdx];
          const link = new SankeyTraceLink(originLink, trace, traceIdx);
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
          l.adjacentDivider = adjacentLinkGroupLength;
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
      node.color = nodesColorMap.get(nodeColorCategoryAccessor(node));
    });
  }
}
