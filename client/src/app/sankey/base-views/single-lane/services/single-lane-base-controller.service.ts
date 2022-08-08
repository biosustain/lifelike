import { Injectable, Injector, OnDestroy } from '@angular/core';

import { flatMap, groupBy, intersection, merge, isNil, isEmpty } from 'lodash-es';
import { switchMap, map, shareReplay } from 'rxjs/operators';
import { of, Observable, defer, iif } from 'rxjs';

import { ViewBase } from 'app/sankey/interfaces';
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
import { Base } from '../interfaces';
import { nodeColors, NodePosition } from '../utils/nodeColors';
import { getBaseState } from '../../../utils/stateLevels';
import { View } from '../../../model/sankey-document';
import { EditService } from '../../../services/edit.service';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class SingleLaneBaseControllerService extends BaseControllerService<Base> implements ServiceOnInit, OnDestroy {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector,
    protected readonly update: EditService
  ) {
    super(common, warningController, injector, update);
    this.onInit();
  }

  viewBase = ViewBase.sankeySingleLane;

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
        highlightCircular: true,
        colorLinkByType: true,
        nodeHeight: {
          min: {
            enabled: true,
            value: 4
          },
          max: {
            enabled: true,
            ratio: 2
          }
        },
        predefinedValueAccessorId: PREDEFINED_VALUE.fixed_height,
      },
      delta
    )),
    switchMap(delta => this.common.options$.pipe(
        map(({predefinedValueAccessors}) =>
          this.pickPartialAccessors(predefinedValueAccessors[delta.predefinedValueAccessorId])
        ),
        map(state => merge({}, delta, state))
      )
    )
  ).pipe(
    debug('SingleLaneBaseControllerService.state$'),
    shareReplay<Base['state']>({bufferSize: 1, refCount: true})
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

  networkTraceData$: Observable<Base['data']> = this.common.data$.pipe(
    switchMap(({links, nodes, getNodeById}) => this.common.networkTrace$.pipe(
        switchMap(({traces, sources, targets}) =>
          this.common.stateAccessor('shortestPathPlusN').pipe(
          map(shortestPathPlusN => ({
            sources,
            targets,
            traces: traces.filter((trace) =>
                trace.shortestPathPlusN ? (trace.shortestPathPlusN <= shortestPathPlusN) : true
              )
          }))
        )
        ),
        map(({sources, targets, traces}) => {
          const networkTraceLinks = this.getNetworkTraceLinks(traces, links);
          const networkTraceNodes = this.common.getNetworkTraceNodes(networkTraceLinks);

          // move this to run in pararell with positioning
          this.colorNodes(networkTraceNodes, sources as any, targets as any);
          return {
            nodes: networkTraceNodes,
            links: networkTraceLinks,
            getNodeById, sources, targets
          };
        }),
        debug('SingleLaneBaseControllerService.networkTraceData$'),
        shareReplay<Base['data']>(1)
      )
    )
  );

  colorLinkTypes$ = unifiedSingularAccessor(this.options$, 'colorLinkTypes');

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
  getNetworkTraceLinks(
    traces: Base['trace'][],
    links: Array<Base['link']>
  ): Array<Base['link']> {
    const traceLink = flatMap(traces, trace => trace.edges.map(linkIdx => ({trace, linkIdx})));
    const linkIdxToTraceLink = groupBy(traceLink, 'linkIdx');
    return Object.entries(linkIdxToTraceLink).map(([linkIdx, wrappedTraces]) => {
      const link = links[linkIdx];
      link.traces = traces;
      return link;
    });
  }

  /**
   * Color nodes if they are in source or target set.
   */
  colorNodes(nodes, sources: Array<Base['node']>, targets: Array<Base['node']>) {
    nodes.forEach(node => node.color = undefined);
    const mapNodePositionToColor = (nodesToColor: Array<Base['node']>, position: NodePosition) =>
      nodesToColor.forEach(node => {
        if (node) {
          node.color = nodeColors.get(position);
        }
      });
    mapNodePositionToColor(sources, NodePosition.left);
    mapNodePositionToColor(targets, NodePosition.right);
    const reused = intersection(sources, targets);
    if (isNotEmpty(reused)) {
      mapNodePositionToColor(reused, NodePosition.multi);
    }
  }
}
