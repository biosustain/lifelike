import { Injectable, Injector } from '@angular/core';

import { flatMap, groupBy, intersection, merge, isEqual } from 'lodash-es';
import { switchMap, map, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { of, Observable, combineLatest } from 'rxjs';

import { SankeyTraceNetwork, SankeyLink, ViewBase } from 'app/sankey/interfaces';
import EdgeColorCodes from 'app/shared/styles/EdgeColorCode';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { BaseControllerService } from 'app/sankey/services/base-controller.service';
import { unifiedSingularAccessor } from 'app/sankey/utils/rxjs';
import { isNotEmpty } from 'app/shared/utils';
import { ErrorMessages } from 'app/sankey/constants/error';
import { debug } from 'app/shared/rxjs/debug';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { PREDEFINED_VALUE, LINK_VALUE_GENERATOR } from 'app/sankey/interfaces/valueAccessors';

import { inputCount } from '../algorithms/linkValues';
import {
  SankeySingleLaneLink,
  SankeySingleLaneNode,
  BaseOptions,
  BaseState,
  SingleLaneNetworkTraceData,
  SankeySingleLaneState
} from '../interfaces';
import { nodeColors, NodePosition } from '../utils/nodeColors';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class SingleLaneBaseControllerService extends BaseControllerService<BaseOptions, BaseState> implements ServiceOnInit {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super(common, warningController, injector);
    this.onInit();
  }

  viewBase = ViewBase.sankeySingleLane;

  // parseDelta$ = this.delta$.pipe(
  //   // @ts-ignore
  //   this.resolvePredefinedValueAccessor(PREDEFINED_VALUE.fixed_height)
  // );

  state$ = combineLatest([
    of({
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
    }),
    this.delta$,
    this.resolvePredefinedValueAccessor(PREDEFINED_VALUE.fixed_height),
    this.resolveView$
  ]).pipe(
    map((deltas) => merge({}, ...deltas)),
    distinctUntilChanged(isEqual),
    debug('SingleLaneBaseControllerService.state$'),
    shareReplay<SankeySingleLaneState>(1)
  );

  highlightCircular$ = this.stateAccessor('highlightCircular');

  linkValueAccessors = {
    ...this.linkValueAccessors,
    [LINK_VALUE_GENERATOR.input_count]: {
      preprocessing: inputCount,
      disabled: () => false
    }
  };

  options$ = of(Object.freeze({
    colorLinkTypes: EdgeColorCodes
  }));

  colorLinkByType$ = this.stateAccessor('colorLinkByType');

  networkTraceData$: Observable<SingleLaneNetworkTraceData> = this.common.partialNetworkTraceData$.pipe(
    map(({links, nodes, nodeById, sources, targets, traces}) => {
      const networkTraceLinks = this.getNetworkTraceLinks(traces, links);
      const networkTraceNodes = this.common.getNetworkTraceNodes(networkTraceLinks, nodeById);

      // move this to run in pararell with positioning
      this.colorNodes(networkTraceNodes, sources, targets);
      return {
        nodes: networkTraceNodes,
        links: networkTraceLinks,
        nodeById,
        sources,
        targets
      };
    }),
    debug('SingleLaneBaseControllerService.networkTraceData$'),
    shareReplay<SingleLaneNetworkTraceData>(1)
  );

  colorLinkTypes$ = unifiedSingularAccessor(this.options$, 'colorLinkTypes');


  // Trace logic
  /**
   * Extract links which relates to certain trace network and
   * assign _color property based on their trace.
   * Also creates duplicates if given link is used in multiple traces.
   * Should return copy of link Objects (do not mutate links!)
   */
  getNetworkTraceLinks(
    traces: SankeyTraceNetwork['traces'],
    links: Array<SankeyLink>
  ): SankeySingleLaneLink[] {
    const traceLink = flatMap(traces, trace => trace.edges.map(linkIdx => ({trace, linkIdx})));
    const linkIdxToTraceLink = groupBy(traceLink, 'linkIdx');
    return Object.entries(linkIdxToTraceLink).map(([linkIdx, wrappedTraces]) => ({
      ...links[linkIdx],
      _traces: wrappedTraces.map(({trace}) => trace)
    }));
  }

  /**
   * Color nodes if they are in source or target set.
   */
  colorNodes(nodes, sourcesIds: number[], targetsIds: number[]) {
    nodes.forEach(node => node._color = undefined);
    const nodeById = new Map<number, SankeySingleLaneNode>(nodes.map(node => [node.id, node]));
    const mapNodePositionToColor = (ids: number[], position: NodePosition) =>
      ids.forEach(id => {
        const node = nodeById.get(id);
        if (node) {
          node._color = nodeColors.get(position);
        } else {
          this.warningController.warn(ErrorMessages.missingNode(id), true);
        }
      });
    mapNodePositionToColor(sourcesIds, NodePosition.left);
    mapNodePositionToColor(targetsIds, NodePosition.right);
    const reusedIds = intersection(sourcesIds, targetsIds);
    if (isNotEmpty(reusedIds)) {
      this.warningController.warn(ErrorMessages.wrongInOutDefinition(reusedIds));
      mapNodePositionToColor(reusedIds, NodePosition.multi);
    }
  }
}
