import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, ElementRef, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SankeyMultiLaneLink } from '../../interfaces';
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
})
export class SankeyMultiLaneComponent extends SankeyAbstractComponent implements AfterViewInit, OnDestroy {
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
    this.initComopnent();
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyMultiLaneLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return super.linkSelection;
  }

  focusedEntity$ = this.sankey.dataToRender$.pipe(
    switchMap(({nodes, links}) => this.search.searchFocus$.pipe(
      map(({type, id}) => {
        let data;
        switch (type) {
          case EntityType.Node:
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            data = nodes.find(({_id}) => _id == id);
            break;
          case EntityType.Link:
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            data = (links as SankeySingleLaneLink[]).find(({_originLinkId}) => _originLinkId == id);
            break;
          default:
            this.sankey.baseView.warningController.warn(`Node type ${type} is not supported`);
        }
        return {type, id, data};
      })
    ))
  );

  initFocus() {
    this.focusedEntity$.subscribe(entity => this.panToEntity(entity));
  }

  initSelection() {
    this.selection.selectedNodes$.subscribe(nodes => {
      if (nodes.size) {
        this.selectNodes(nodes);
      } else {
        this.deselectNodes();
      }
    });

    this.selection.selectedLinks$.subscribe(links => {
      if (links.size) {
        this.selectLinks(links);
      } else {
        this.deselectLinks();
      }
    });

    combineLatest([
      this.selection.selectedNodes$,
      this.selection.selectedLinks$
    ]).subscribe(([nodes, links]) => {
      if (nodes || links) {
        this.calculateAndApplyTransitiveConnections(nodes, links);
      }
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
  async pathMouseOver(element, data) {
    d3_select(element)
      .raise();
  }

  /**
   * Callback that undims all nodes/links.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
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
  async nodeMouseOut(element, data) {
    this.unhighlightNode(element);

    // temporary disabled as of LL-3726
    // this.unhighlightNodes();
    // this.unhighlightLinks();
  }

  // endregion

  // region Select
  /**
   * Adds the `selected` property to the given input nodes.
   * @param nodes set of node data objects to use for selection
   */
  selectNodes(nodes: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('selected', n => nodes.has(n));
  }

  /**
   * Adds the `selected` property to the given input links.
   * @param links set of link data objects to use for selection
   */
  selectLinks(links: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selected', l => links.has(l));
  }


  /**
   * Given the set of selected nodes and links, calculcates the connected nodes/links and applies the `transitively-selected` attribute to
   * them.
   * @param nodes the full set of currently selected nodes
   * @param links the full set of currently selected links
   */
  calculateAndApplyTransitiveConnections(nodes: Set<object>, links: Set<object>) {
    if (nodes.size + links.size === 0) {
      this.nodeSelection
        .attr('transitively-selected', undefined);
      this.linkSelection
        .attr('transitively-selected', undefined);
      return;
    }

    const traces = new Set<any>();
    links.forEach((link: any) => traces.add(link._trace));
    nodes.forEach((data: any) => [].concat(data._sourceLinks, data._targetLinks).forEach(link => traces.add(link._trace)));
    const nodeGroup = this.calculateNodeGroupFromTraces(traces);


    this.nodeSelection
      .attr('transitively-selected', ({id}) => nodeGroup.has(id));
    this.linkSelection
      .attr('transitively-selected', ({_trace}) => traces.has(_trace));
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
    const {
      nodeLabelShort, nodeLabelShouldBeShorted, nodeLabel
    } = this.sankey;
    const selection = d3_select(element)
      .raise()
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(nodeLabelShort)
          .filter(nodeLabelShouldBeShorted)
          // todo: reenable when performance improves
          // .transition().duration(RELAYOUT_DURATION)
          // .textTween(n => {
          //   const label = nodeLabelAccessor(n);
          //   const length = label.length;
          //   const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
          //   return t => t === 1 ? label :
          //     (label.slice(0, interpolator(t)) + '...').slice(0, length);
          // })
          .text(nodeLabel);
      });
    // postpone so the size is known
    requestAnimationFrame(_ =>
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
