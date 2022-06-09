import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, NgZone, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, Selection as d3_Selection } from 'd3-selection';
import { flatMap, groupBy, uniq } from 'lodash-es';
import { combineLatest, forkJoin, zip, animationFrameScheduler } from 'rxjs';
import { switchMap, map, tap, takeUntil, publish, throttle, throttleTime, first, filter, withLatestFrom } from 'rxjs/operators';

import { EntityType } from 'app/sankey/interfaces/search';
import { SelectionType } from 'app/sankey/interfaces/selection';
import { LayoutService } from 'app/sankey/services/layout.service';
import { SankeySearchService } from 'app/sankey/services/search.service';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { symmetricDifference } from 'app/sankey/utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { isNotEmpty } from 'app/shared/utils';
import { d3EventCallback } from 'app/shared/utils/d3';
import { getBoundingRect } from 'app/shared/utils/extent';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { Base } from '../../interfaces';
import { MultiLaneLayoutService } from '../../services/multi-lane-layout.service';
import { updateAttr } from '../../../../utils/rxjs';
import { EditService } from '../../../../services/edit.service';
import { Trace } from '../../../../model/sankey-document';
import { keyedExtentToArray } from '../../../../utils/zoom';
import { zoomIdentity } from 'd3';

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

  focusedLinks$ = this.sankey.graph$.pipe(
    switchMap(({links}) =>
      this.search.searchFocus$.pipe(
        // map graph file link to sankey link
        map(({type, id}) => {
          if (type === EntityType.Link) {
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            return (links as Base['link'][]).filter(({originLinkId}) => originLinkId == id);
          }
          if (type === EntityType.Trace) {
            return (links as Base['link'][]).filter(link => link.belongsToTrace(id));
          }
          return [];
        }),
        updateAttr(this.renderedLinks$, 'focused')
      )
    ),
    // tap(current => isNotEmpty(current) && this.panToLinks(current))
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
      ),
      selection$.pipe(
        map(({
               [SelectionType.node]: nodes = [],
               [SelectionType.link]: links = [],
               [SelectionType.trace]: traces = []
             }) => uniq(
            flatMap(
              nodes as Base['node'][],
              ({sourceLinks, targetLinks}) => [...sourceLinks, ...targetLinks]
            )
              .concat(links as Base['link'][])
              .map(({trace}) => trace)
              .concat(traces as any as Base['trace'][])
          )
        ),
        publish(traces$ =>
          zip(
            traces$.pipe(
              map(traces => this.calculateNodeGroupFromTraces(traces)),
              updateAttr(this.renderedNodes$, 'transitively-selected', {accessor: (arr, {id}) => arr.includes(id)})
            ),
            traces$.pipe(
              updateAttr(this.renderedLinks$, 'transitively-selected', {accessor: (arr, {trace}) => arr.includes(trace)})
            )
          )
        )
      )
    ]))
  );

  panToLinks({links}) {
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

  panToNode({x0, x1, y0, y1}) {
    this.zoom.translateTo(
      // x
      (x0 + x1) / 2,
      // y
      (y0 + y1) / 2,
      undefined,
      true
    );
  }

  ngOnInit() {
    super.ngOnInit();
  }

  isVisible(extent, width, height) {
    const currentTransform = this.zoom.zoomTransform;

    return (
      currentTransform.applyX(extent.x0) >= 0 &&
      currentTransform.applyY(extent.y0) >= 0 &&
      currentTransform.applyX(extent.x1) <= width &&
      currentTransform.applyY(extent.y1) <= height
    );
  }

  initFocus() {
    this.search.searchFocus$.pipe(
      withLatestFrom(
        combineLatest(
          this.focusedLinks$,
          this.focusedNode$
        )
      ),
      // Do not return value more often than once per frame
      throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
      takeUntil(this.destroyed$),
      // cannot simply merge selection in diff parents
      // map(selections => selections.reduce((merged, selection) => merged.merge(selection)))
      switchMap(([focus, [focusedLinkSelection, focusedNodeSelection]]) => {
        const rect = getBoundingRect([
          getBoundingRect.from(focusedLinkSelection.nodes().map(el => {
            const {x, y, width, height} = el.getBBox();
            return {
              width: width + 20,
              height,
              x: x - 10,
              y,
            };
          })),
          getBoundingRect.from(focusedNodeSelection.nodes().map(el => {
            const data = el.__data__;
            const {x, y, width, height} = el.getBBox();
            return {
              width, height,
              x: x + data.x0,
              y: y + data.y0,
            };
          }))
        ]);
        const zoomExtent = keyedExtentToArray(rect);
        return this.zoomTransformForExtent(zoomExtent).pipe(
          first(),
          filter(({transform, width, height}) => !this.isVisible(rect, width, height)),
          tap(({transform, p}) => {
            let tr = transform;
            // if (transform.k > this.zoom.zoomTransform.k) {
            //   tr = zoomIdentity.scale(this.zoom.zoomTransform.k).translate(transform.x, transform.y);
            // }
            if (transform.k === 1) {
              tr = zoomIdentity;
            }
            this.zoom.transform(tr, p, true);
          })
        );
      })
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
  highlightTraces(traces: Set<object>) {
    this.assignAttrAndRaise(this.linkSelection, 'highlighted', ({trace}) => traces.has(trace));
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
