import { Injectable, Injector } from '@angular/core';

import { flatMap, groupBy, intersection, pick } from 'lodash-es';
import { switchMap, map, tap } from 'rxjs/operators';
// @ts-ignore
import { tag } from 'rxjs-spy/operators/tag';
import { of, BehaviorSubject } from 'rxjs';

import { LINK_VALUE_GENERATOR, ValueGenerator, SankeyTraceNetwork, SankeyLink, ViewBase, PREDEFINED_VALUE } from 'app/sankey/interfaces';
import EdgeColorCodes from 'app/shared/styles/EdgeColorCode';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { ControllerService } from 'app/sankey/services/controller.service';
import { BaseControllerService } from 'app/sankey/services/base-controller.service';

import { inputCount } from '../algorithms/linkValues';
import { SankeySingleLaneLink, SankeySingleLaneState, SankeySingleLaneOptions, SankeySingleLaneNode } from '../components/interfaces';
import { nodeColors, NodePosition } from '../utils/nodeColors';
import { unifiedAccessor, unifiedSingularAccessor } from '../../../services/state-controlling-abstract.service';

/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
// @ts-ignore
export class SingleLaneBaseControllerService extends BaseControllerService<SankeySingleLaneOptions, SankeySingleLaneState> {
  constructor(
    readonly common: ControllerService,
    readonly warningController: WarningControllerService,
    readonly injector: Injector
  ) {
    super(common, warningController, injector);
    console.log('SankeySingleLaneControllerService');
    this.onInit();
    this.graphInputState$ = this.common.state$.pipe(
      map(state => pick(state, ['nodeAlign', 'normalizeLinks'])),
      // disable so temp each change cause update
      // distinctUntilChanged(isEqual)
    );
    // this.state$.subscribe(s => console.warn('SankeySingleLaneControllerService state$', s));
    // this.dataToRender$.subscribe(d => console.log('data to render', d));
    // this.networkTraceData$.subscribe(d => console.log('SankeySingleLaneControllerService networkTraceData$', d));
    // this.defaultState$.subscribe(d => console.log('defaultState$ construct subscription', d));
    // this.nodeValueAccessor$.subscribe(d => console.log('nodeValueAccessor$ construct subscription', d));
    // this.linkValueAccessor$.subscribe(d => console.log('linkValueAccessor$ construct subscription', d));
    // this.predefinedValueAccessor$.subscribe(d => console.log('predefinedValueAccessor$ construct subscription', d));
    // this.options$.subscribe(d => console.log('options$ construct subscription', d));
  }

  viewBase = ViewBase.sankeySingleLane;

  default$ = this.common.options$.pipe(
    map(({predefinedValueAccessors}) => ({
      predefinedValueAccessorId: PREDEFINED_VALUE.fixed_height,
      ...pick(predefinedValueAccessors[PREDEFINED_VALUE.fixed_height], ['nodeValueAccessorId', 'linkValueAccessorId']),
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
    }))
  );

  linkValueAccessors = {
    ...this.linkValueAccessors,
    [LINK_VALUE_GENERATOR.input_count]: {
      preprocessing: inputCount,
      disabled: () => false
    } as ValueGenerator
  };

  options$ = of(Object.freeze({
    colorLinkTypes: EdgeColorCodes
  }));

  delta$ = new BehaviorSubject({});

  networkTraceData$ = this.common.partialNetworkTraceData$.pipe(
    switchMap(({links, nodes, sources, targets, traces}) => this.state$.pipe(
      map(({colorLinkByType}) => {
        const networkTraceLinks = this.getNetworkTraceLinks(traces, links);
        const networkTraceNodes = this.common.getNetworkTraceNodes(networkTraceLinks, nodes);
        if (colorLinkByType) {
          this.colorLinkByType(networkTraceLinks);
        }
        this.colorNodes(networkTraceNodes, sources, targets);
        return {
          nodes: networkTraceNodes,
          links: networkTraceLinks,
          sources,
          targets
        };
      })
    ))
  );

  dataToRender$ = this.networkTraceData$.pipe(
    tap(d => console.log('dataToRender$ networkTraceData', d)),
    switchMap(networkTraceData => this.linkGraph(networkTraceData)),
    tap(d => console.log('dataToRender$', d)),
  );

  graphInputState$;

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
