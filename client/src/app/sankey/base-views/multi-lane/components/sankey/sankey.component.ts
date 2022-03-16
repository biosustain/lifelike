import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, NgZone, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { combineLatest } from 'rxjs';
import { switchMap, map, tap, takeUntil, publish } from 'rxjs/operators';
import { flatMap, groupBy, uniq } from 'lodash-es';

import { SankeyTrace, SelectionType } from 'app/sankey/interfaces';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { SankeySearchService } from 'app/sankey/services/search.service';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { isNotEmpty } from 'app/shared/utils';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SankeyMultiLaneLink, SankeyMultiLaneNode, SankeyMultiLaneOptions, SankeyMultiLaneState } from '../../interfaces';
import { MultiLaneLayoutService } from '../../services/multi-lane-layout.service';
import { EntityType } from '../../../../utils/search/search-match';
import { updateAttr, updateAttrSingular } from '../../../../utils/rxjs';

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
    selection.multiselect = true;
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyMultiLaneLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return super.linkSelection;
  }

  focusedLinks$ = this.sankey.graph$.pipe(
    switchMap(({links}) =>
          this.search.searchFocus$.pipe(
            // map graph file link to sankey link
            map(({type, id}) =>
              type === EntityType.Link ?
                // allow string == number match interpolation ("58" == 58 -> true)
                // tslint:disable-next-line:triple-equals
                (links as SankeyMultiLaneLink[]).filter(({_originLinkId}) => _originLinkId == id) : []
            ),
            updateAttr(this.renderedLinks$, 'focused')
          )
    ),
    tap(current => isNotEmpty(current) && this.panToLinks(current))
  );

  selectionUpdate$ = this.selection.selection$.pipe(
        map(selection => groupBy(selection, 'type')),
        publish(selection$ => combineLatest([
          selection$.pipe(
            map(({[SelectionType.node]: nodes = []}) => nodes.map(({entity}) => entity)),
            updateAttr(this.renderedNodes$, 'selected')
          ),
          selection$.pipe(
            map(({[SelectionType.link]: links = []}) => links.map(({entity}) => entity)),
            updateAttr(this.renderedLinks$, 'selected')
          ),
          selection$.pipe(
            map(({[SelectionType.trace]: traces = []}) => traces),
            // todo
          )
        ])),
        map(([nodes = [], links = [], _traces = []]) => uniq(
            flatMap(
              nodes as SankeyMultiLaneNode[],
              ({_sourceLinks, _targetLinks}) => [..._sourceLinks, ..._targetLinks]
            )
              .concat(links as SankeyMultiLaneLink[])
              .map(({_trace}) => _trace)
              .concat(_traces as any as SankeyTrace[])
          )
        ),
        publish(traces$ => combineLatest([
          traces$.pipe(
            map(traces => this.calculateNodeGroupFromTraces(traces)),
            updateAttr(this.renderedNodes$, 'transitively-selected', {accessor: (arr, {id}) => arr.includes(id)})
          ),
          traces$.pipe(
            updateAttr(this.renderedLinks$, 'transitively-selected', {accessor: (arr, {_trace}) => arr.includes(_trace)})
          )
        ]))
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
    this.selectionUpdate$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();
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
  calculateNodeGroupFromTraces(traces: SankeyTrace[]) {
    return uniq(
      flatMap(
        traces,
        trace => flatMap(
          trace.node_paths
        )
      )
    );
  }

  // endregion
}
