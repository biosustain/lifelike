import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit } from '@angular/core';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { combineLatest } from 'rxjs';
import { switchMap, map, pairwise, startWith, tap, takeUntil } from 'rxjs/operators';
import { isEmpty, flatMap } from 'lodash-es';

import { mapIterable } from 'app/shared/utils';
import { SankeyId, SankeyTrace } from 'app/sankey/interfaces';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SankeyMultiLaneLink, SankeyMultiLaneNode, SankeyMultiLaneOptions, SankeyMultiLaneState } from '../../interfaces';
import { MultiLaneLayoutService } from '../../services/multi-lane-layout.service';
import { EntityType } from '../../../../utils/search/search-match';
import { SankeySingleLaneLink } from '../../../single-lane/interfaces';

@Component({
  selector: 'app-sankey-multi-lane',
  templateUrl: '../../../../abstract/sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [
    MultiLaneLayoutService,
    {
      provide: LayoutService,
      useExisting: MultiLaneLayoutService,
    }
  ]
})
export class SankeyMultiLaneComponent
  extends SankeyAbstractComponent<SankeyMultiLaneOptions, SankeyMultiLaneState>
  implements OnInit, AfterViewInit, OnDestroy {
  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyMultiLaneLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return super.linkSelection;
  }

  focusedLinks$ = this.sankey.graph$.pipe(
    switchMap(({links}) => this.search.searchFocus$.pipe(
        map(({type, id}) =>
          type === EntityType.Link &&
          // allow string == number match interpolation ("58" == 58 -> true)
          // tslint:disable-next-line:triple-equals
          (links as SankeySingleLaneLink[]).filter(({_originLinkId}) => _originLinkId == id)
        ),
        startWith([]),
        pairwise(),
        map(([prev, next]) => ({
          added: next.filter(link => !prev.includes(link)),
          affected: prev.concat(next)
        }))
      )
    ),
    tap(({added, affected}) =>
      this.linkSelection
        .filter(link => affected.includes(link))
        .each(function(link) {
          const add = added.includes(link);
          const linkSelection = d3_select(this);
          linkSelection
            .attr('focused', add || undefined);
          if (add) {
            linkSelection
              .raise();
          }
        })
    ),
    tap(({added}) => this.panToLinks(added))
  );

  panToLinks(links) {
    const [sumX, sumY] = links.reduce(([x, y], {_source: {_x1}, _target: {_x0}, _y0, _y1}) => [
      x + _x0 + _x1,
      y + _y0 + _y1
    ], [0, 0]);
    this.sankeySelection.transition().call(
      this.zoom.translateTo,
      // average x
      sumX / (2 * links.length),
      // average y
      sumY / (2 * links.length)
    );
  }


  ngOnInit() {
    super.ngOnInit();
  }

  initFocus() {
    this.focusedLinks$.subscribe();
    this.focusedNode$.subscribe();
  }

  initSelection() {
    combineLatest([
      this.selection.selectedNodes$,
      this.selection.selectedLinks$
    ]).pipe(
      takeUntil(this.destroy$),
      map(([nodes, links]) => ({
        nodes: new Set(nodes),
        links: new Set(links)
      }))
    ).subscribe(({nodes, links}) => {
      if (nodes.size) {
        this.selectNodes(mapIterable(nodes, ({_id}) => _id));
      } else {
        this.deselectNodes();
      }
      if (links.size) {
        this.selectLinks(mapIterable(links, ({_id}) => _id));
      } else {
        this.deselectLinks();
      }
      this.calculateAndApplyTransitiveConnections(nodes, links);
    });
  }

  // endregion

  ngAfterViewInit() {
    super.ngAfterViewInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered path.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  @d3EventCallback
  async pathMouseOver(element, data) {
    d3_select(element)
      .raise();
  }

  /**
   * Callback that undims all nodes/links.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  @d3EventCallback
  async pathMouseOut(element, data) {
    // temporary disabled as of LL-3726
    // this.unhighlightNodes();
    // this.unhighlightLinks();
  }

  /**
   * Callback that undims all nodes/links. Also unsets hover styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  @d3EventCallback
  async nodeMouseOut(element, data) {
    this.unhighlightNode(element);

    // temporary disabled as of LL-3726
    // this.unhighlightNodes();
    // this.unhighlightLinks();
  }

  // region Select
  /**
   * Adds the `selected` property to the given input nodes.
   * @param nodesIds set of node data objects to use for selection
   */
  selectNodes(nodesIds: Set<SankeyId>) {
    this.nodeSelection
      .attr('selected', ({_id}) => nodesIds.has(_id));
  }

  /**
   * Adds the `selected` property to the given input links.
   * @param linksIds set of link data objects to use for selection
   */
  selectLinks(linksIds: Set<SankeyId>) {
    return this.linkSelection
      .attr('selected', ({_id}) => linksIds.has(_id));
  }


  /**
   * Given the set of selected nodes and links, calculcates the connected nodes/links and applies the `transitively-selected` attribute to
   * them.
   * @param nodes the full set of currently selected nodes
   * @param links the full set of currently selected links
   */
  calculateAndApplyTransitiveConnections(nodes: Set<SankeyMultiLaneNode>, links: Set<SankeyMultiLaneLink>) {
    if (isEmpty(nodes) && isEmpty(links)) {
      this.nodeSelection
        .attr('transitively-selected', undefined);
      this.linkSelection
        .attr('transitively-selected', undefined);
    } else {
      const traces = new Set<SankeyTrace>(
        flatMap(
          [...nodes],
          ({_sourceLinks, _targetLinks}) => [..._sourceLinks, ..._targetLinks]
        )
          .concat([...links])
          .map(({_trace}) => _trace)
      );
      const nodeGroup = this.calculateNodeGroupFromTraces(traces);

      this.nodeSelection
        .attr('transitively-selected', ({id}) => nodeGroup.has(id));
      this.linkSelection
        .attr('transitively-selected', ({_trace}) => traces.has(_trace));
    }
  }

  // endregion

  // region Highlight
  highlightTraces(traces: Set<object>) {
    this.assignAttrAndRaise(this.linkSelection, 'highlighted', ({_trace}) => traces.has(_trace));
  }

  highlightNodeGroup(group) {
    this.nodeSelection
      .attr('highlighted', ({id}) => group.has(id));
  }

  highlightNode(element) {
    const selection = d3_select(element)
      .raise()
      .select('g')
      .call(this.extendNodeLabel);
    // postpone so the size is known
    requestAnimationFrame(() =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  /**
   * Given a set of traces, returns a set of all nodes within those traces.
   * @param traces a set of trace objects
   * @returns a set of node ids representing all nodes in the given traces
   */
  calculateNodeGroupFromTraces(traces: Set<any>) {
    const nodeGroup = new Set<number>();
    traces.forEach(
      trace => trace.node_paths.forEach(
        path => path.forEach(
          nodeId => nodeGroup.add(nodeId)
        )
      )
    );
    return nodeGroup;
  }

  // endregion
}
