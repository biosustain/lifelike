import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, ElementRef, NgZone, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { combineLatest } from 'rxjs';
import { switchMap, map, pairwise } from 'rxjs/operators';
import { isEmpty, flatMap } from 'lodash-es';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { mapIterable } from 'app/shared/utils';
import { SankeyId, SankeyTrace } from 'app/sankey/interfaces';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SankeyMultiLaneLink, SankeyMultiLaneNode, SankeyMultiLaneOptions, SankeyMultiLaneState } from '../../interfaces';
import { MultiLaneLayoutService } from '../../services/multi-lane-layout.service';
import { SankeySelectionService } from '../../../../services/selection.service';
import { SankeySearchService } from '../../../../services/search.service';
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
export class SankeyMultiLaneComponent extends SankeyAbstractComponent<SankeyMultiLaneOptions, SankeyMultiLaneState>
  implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: MultiLaneLayoutService,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService
  ) {
    super(clipboard, snackBar, sankey, wrapper, zone, selection, search);
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyMultiLaneLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return super.linkSelection;
  }


  ngOnInit() {
    super.ngOnInit();
  }
  //
  // initFocus() {
  //   this.focusedNode$.pipe(
  //     pairwise(),
  //   ).subscribe(([prevFocus, node]) => {
  //     if (prevFocus) {
  //       this.unFocusNodes(prevFocus);
  //     }
  //     if (node) {
  //       this.focusNodes(node);
  //       this.panToNodes(node);
  //     }
  //   });
  //
  //   this.focusedLink$.pipe(
  //     pairwise(),
  //   ).subscribe(([prevFocus, link]) => {
  //     if (prevFocus) {
  //       this.unFocusLink(prevFocus);
  //     }
  //     if (link) {
  //       this.focusLink(link);
  //       this.panToLink(link);
  //     }
  //   });
  // }

  initSelection() {
    combineLatest([
      this.selection.selectedNodes$,
      this.selection.selectedLinks$
    ]).pipe(
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
