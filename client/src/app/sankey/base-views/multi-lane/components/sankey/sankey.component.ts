import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, NgZone, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { flatMap, groupBy, uniq, isNil, mapValues, isEmpty } from 'lodash-es';
import { combineLatest, forkJoin, iif, zip, of } from 'rxjs';
import { switchMap, map, tap, takeUntil, publish, first } from 'rxjs/operators';

import { EntityType } from 'app/sankey/interfaces/search';
import { SelectionType } from 'app/sankey/interfaces/selection';
import { LayoutService } from 'app/sankey/services/layout.service';
import { SankeySearchService } from 'app/sankey/services/search.service';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { symmetricDifference } from 'app/sankey/utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { isNotEmpty } from 'app/shared/utils';
import { d3EventCallback } from 'app/shared/utils/d3';


import { createMapToColor, DEFAULT_ALPHA, DEFAULT_SATURATION } from '../../color-palette';
import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { Base } from '../../interfaces';
import { MultiLaneLayoutService } from '../../services/multi-lane-layout.service';
import { EditService } from '../../../../services/edit.service';
import { getTraces } from '../../utils';

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
  extends SankeyAbstractComponent<Base>
  implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    protected readonly clipboard: ClipboardService,
    protected readonly snackBar: MatSnackBar,
    protected readonly sankey: MultiLaneLayoutService,
    protected readonly wrapper: ElementRef,
    protected readonly zone: NgZone,
    protected readonly selection: SankeySelectionService,
    protected readonly search: SankeySearchService,
    protected readonly updateController: EditService
  ) {
    super(clipboard, snackBar, sankey, wrapper, zone, selection, search, updateController);
    selection.multiselect = true;
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, Base['link'], any, any> {
    // returns empty selection if DOM struct was not initialised
    return super.linkSelection;
  }

  focusedLinks$ = this.search.searchFocus$.pipe(
    switchMap(searchFocus =>
      this.sankey.graph$.pipe(
        first(),
        // map graph file link to sankey link
        map(({links}) =>
          searchFocus?.type === EntityType.Link ?
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            (links as Base['link'][]).filter(({originLinkId}) => originLinkId == searchFocus?.id) : []
        ),
        tap(current => isNotEmpty(current) && this.panToLinks(current)),
        switchMap(current => this.renderedLinks$.pipe(
          tap(renderedLinks => {
            if (isEmpty(current)) {
              renderedLinks.attr('focused', undefined);
            } else {
              renderedLinks
                .attr('focused', d => current.includes(d))
                .filter(d => current.includes(d))
                .raise();
            }
          })
        ))
      )
    )
  );

  // focusedTrace$ = this.sankey.baseView.common.networkTrace$.pipe(
  //   switchMap(({traces}) =>
  //     this.search.searchFocus$.pipe(
  //       map(({type, idx}) => type === EntityType.Trace ? traces[idx] : undefined),
  //       switchMap(entity =>
  //         iif(
  //           () => isNil(entity),
  //           zip(
  //             of(entity).pipe(
  //               tap(e => console.log(e)),
  //               updateAttr(this.renderedLinks$, 'focused'),
  //               tap(current => isNotEmpty(current) && this.panToLinks(current))
  //             ),
  //             of(entity).pipe(
  //               tap(e => console.log(e)),
  //               updateAttr(this.renderedNodes$, 'focused')
  //             )
  //           )
  //         )
  //       )
  //     )
  //   )
  // );

  selectionUpdate$ = this.selection.selection$.pipe(
    map(selection =>
      mapValues(
        groupBy(selection, 'type'),
        group => group.map(({entity}) => entity)
      )
    ),
    publish(selection$ => combineLatest([
      selection$.pipe(
        map(({[SelectionType.node]: nodes = []}) => nodes),
        switchMap(selection => this.renderedNodes$.pipe(
          tap(renderedNodes => {
            if (isEmpty(selection)) {
              renderedNodes.attr('selected', undefined);
            } else {
              renderedNodes
                .attr('selected', d => selection.includes(d))
                .filter(d => selection.includes(d))
                .raise();
            }
          })
        ))
      ),
      selection$.pipe(
        map(({[SelectionType.link]: links = []}) => links),
        switchMap(selection => this.renderedLinks$.pipe(
          tap(renderedLinks => {
            if (isEmpty(selection)) {
              renderedLinks.attr('selected', undefined);
            } else {
              renderedLinks
                .attr('selected', d => selection.includes(d))
                .filter(d => selection.includes(d))
                .raise();
            }
          })
        ))
      ),
      selection$.pipe(
        map(({
               [SelectionType.trace]: traces = [],
               [SelectionType.link]: links = [],
               [SelectionType.node]: nodes = []
             }) => getTraces({nodes, links}).concat(traces),
        ),
        publish(traces$ => combineLatest([
          traces$.pipe(
            map(traces => this.calculateNodeGroupFromTraces(traces)),
            switchMap(selection => this.renderedNodes$.pipe(
              tap(renderedNodes => {
                if (isEmpty(selection)) {
                  renderedNodes.attr('transitively-selected', undefined);
                } else {
                  renderedNodes
                    .attr('transitively-selected', ({id}) => selection.includes(id))
                    .filter( ({id}) => selection.includes(id))
                    .raise();
                }
              })
            ))
          ),
          traces$.pipe(
            switchMap(traces => this.renderedLinks$.pipe(
                tap(renderedLinks => {
                  if (isEmpty(traces)) {
                    renderedLinks.attr('transitively-selected', undefined);
                  } else {
                    renderedLinks
                      .attr('transitively-selected', ({trace}) => traces.includes(trace))
                      .filter(({trace}) => traces.includes(trace))
                      .raise();
                  }
                })
              )
            )
          )
        ]))
      )
    ]))
  );

  panToLinks(links) {
    const [sumX, sumY] = links.reduce(([x, y], {source: {x1}, target: {x0}, y0, y1}) => [
      x + x0 + x1,
      y + y0 + y1
    ], [0, 0]);
    this.zoom.translateTo(
      // average x
      sumX / (2 * links.length),
      // average y
      sumY / (2 * links.length),
      undefined,
      true
    );
  }

  ngOnInit() {
    super.ngOnInit();
  }

  initFocus() {
    forkJoin(
      this.focusedLinks$,
      this.focusedNode$,
      // this.focusedTrace$
    ).pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  initSelection() {
    this.selectionUpdate$.pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  initStateUpdate() {
    const {
      sankey: {
        linkBorder,
      }
    } = this;

    this.sankey.baseView.traceGroupColorMapping$.pipe(
      takeUntil(this.destroyed$),
      switchMap((traceColorPaletteMap) =>
        combineLatest([
          this.renderedLinks$,
          this.renderedNodes$,
        ]).pipe(
          tap(([linksSelection, nodesSelection]) => {
            linksSelection
              .style('fill', (d: Base['link']) => traceColorPaletteMap.get(d.trace.group))
              .style('stroke', linkBorder as any);

            nodesSelection
              .select('rect')
              .style('fill', ({sourceLinks, targetLinks, color}: Base['node']) => {
                // check if any trace is finishing or starting here
                const difference = symmetricDifference(sourceLinks, targetLinks, link => link.trace);
                // if there is only one trace start/end then color node with its color
                if (difference.size === 1) {
                  return traceColorPaletteMap.get(difference.values().next().value.trace.group);
                } else {
                  return color;
                }
              });
          }),
        )
      )
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
  // highlightTraces(traces: Set<object>) {
  //   this.assignAttrAndRaise(this.linkSelection, 'highlighted', ({trace}) => traces.has(trace));
  // }

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
  calculateNodeGroupFromTraces(traces: Base['trace'][]) {
    return uniq(
      flatMap(
        traces,
        trace => flatMap(
          trace.nodePaths
        )
      )
    );
  }

  // endregion
}
