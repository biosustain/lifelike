import { AfterViewInit, ElementRef, OnDestroy, ViewChild, NgZone, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, ValueFn as d3_ValueFn, Selection as d3_Selection, event as d3_event } from 'd3-selection';
import { drag as d3_drag } from 'd3-drag';
import { map, switchMap, first, tap, publish, takeUntil, shareReplay, pairwise, throttleTime } from 'rxjs/operators';
import { combineLatest, Subject, animationFrameScheduler } from 'rxjs';
import { assign, partial, groupBy, isEmpty } from 'lodash-es';
import { zoomIdentity, zoomTransform } from 'd3';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { createResizeObservable } from 'app/shared/rxjs/resize-observable';
import { SankeyId, TypeContext, SankeyLinkInterface } from 'app/sankey/interfaces';
import { debug } from 'app/shared/rxjs/debug';
import { d3Callback, d3EventCallback } from 'app/shared/utils/d3';

import { representativePositiveNumber } from '../utils';
import { SankeySelectionService } from '../services/selection.service';
import { SankeySearchService } from '../services/search.service';
import { LayoutService } from '../services/layout.service';
import { Zoom } from '../utils/zoom';
import { Match, EntityType } from '../interfaces/search';
import { EditService } from '../services/edit.service';

export type DefaultSankeyAbstractComponent = SankeyAbstractComponent<TypeContext>;

export abstract class SankeyAbstractComponent<Base extends TypeContext>
  implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    protected readonly clipboard: ClipboardService,
    protected readonly snackBar: MatSnackBar,
    protected readonly sankey: LayoutService<Base>,
    protected readonly wrapper: ElementRef,
    protected readonly zone: NgZone,
    protected readonly selection: SankeySelectionService,
    protected readonly search: SankeySearchService,
    protected readonly updateController: EditService
  ) {
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, Base['link'], any, any> {
    // returns empty selection if DOM struct was not initialised
    return d3_select(this.links.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get nodeSelection(): d3_Selection<any, Base['node'], any, any> {
    // returns empty selection if DOM struct was not initialised
    return d3_select(this.nodes.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get sankeySelection() {
    return d3_select(this.svg && this.svg.nativeElement);
  }

  ellipsisAfterXCharacters$ = this.sankey.baseView.common.labelEllipsis$.pipe(
    map(({enabled, value}) => enabled ? value : null)
  );

  fontSizeScale$ = this.sankey.baseView.common.fontSizeScale$;

  focusedNode$ = this.sankey.graph$.pipe(
    switchMap(({nodes}) => this.search.searchFocus$.pipe(
      map(searchFocus =>
        searchFocus?.type === EntityType.Node &&
        // allow string == number match interpolation ("58" == 58 -> true)
        // tslint:disable-next-line:triple-equals
        nodes.find(({id: nodeId}) => nodeId == searchFocus?.id)
      ),
      tap((node: Base['node']) => node && this.panToNode(node as any)),
      switchMap(node => this.renderedNodes$.pipe(
        tap(renderedNodes => {
          if (!node) {
            renderedNodes.attr('focused', undefined);
          } else {
            renderedNodes
              .attr('focused', d => node === d)
              .filter(d => node === d)
              .raise();
          }
        })
      ))
    )),
    debug('focusedNode$')
  );

  readonly MARGIN = 10;

  margin = {
    top: this.MARGIN,
    right: this.MARGIN,
    bottom: this.MARGIN,
    left: this.MARGIN
  };

  destroyed$ = new Subject();

  @ViewChild('svg', {static: true}) svg!: ElementRef;
  @ViewChild('g', {static: true}) g!: ElementRef;
  @ViewChild('zoomDebug', {static: true}) zoomDebug!: ElementRef;
  @ViewChild('nodes', {static: true}) nodes!: ElementRef;
  @ViewChild('links', {static: true}) links!: ElementRef;

  zoom: Zoom<SVGElement, number>;
  width: number;
  height: number;

  horizontalStretch$ = this.sankey.horizontalStretch$;

  // resize and listen to future resize events
  // would be nice to listen on #g but SVG lacks support for that
  viewBox$ = createResizeObservable(this.wrapper.nativeElement, {leading: true})
    .pipe(
      takeUntil(this.destroyed$),
      map(viewPort => ({
        width: viewPort.width - this.margin.left - this.margin.right,
        height: viewPort.height - this.margin.top - this.margin.bottom
      })),
      shareReplay({refCount: true, bufferSize: 1})
    );

  vbsubs = this.viewBox$
    .subscribe(({width, height}) => {
      this.width = width;
      this.height = height;
      this.sankey.setViewPort({
        x0: 0,
        y0: 0,
        x1: width,
        y1: height
      });
    });

  zoomAdjust = this.viewBox$.pipe(
    pairwise(),
    map(([prev, next]) => ({
      widthChange: next.width / prev.width,
      heightChange: next.height / prev.height,
      widthDelta: next.width - prev.width,
      heightDelta: next.height - prev.height
    }))
  ).subscribe(({widthDelta, heightDelta, widthChange, heightChange}) => {
    const transform = zoomTransform(this.svg.nativeElement);
    const k = Math.abs(widthChange - 1) > Math.abs(heightChange - 1) ? widthChange : heightChange;
    const newTransform = transform.translate(
      widthDelta / 2 / transform.k,
      heightDelta / 2 / transform.k
    );
    this.zoom.transform(newTransform, undefined, true);
  });

  renderedLinks$ = combineLatest([
    this.sankey.graph$,
    this.sankey.linkPath$
  ]).pipe(
    map(([{links}, linkPath]) => {
      const {
        sankey: {
          id,
          linkTitle,
          circular
        }
      } = this;
      const layerWidth = ({source, target}: SankeyLinkInterface) => Math.abs(target.layer - source.layer);

      // save selection in this point so we can forward d3 lifecycle groups
      return this.linkSelection
        .data<Base['link']>(links.sort((a, b) => layerWidth(b) - layerWidth(a)), id)
        .join(
          enter => enter
            .append('path')
            .call(this.attachLinkEvents)
            .attr('d', linkPath)
            .classed('circular', circular)
            .call(path =>
              path.append('title')
            ),
          update => update
            // todo: reenable when performance improves
            // .transition().duration(RELAYOUT_DURATION)
            // .attrTween('d', link => {
            //   const newPathParams = calculateLinkPathParams(link, this.normalizeLinks);
            //   const paramsInterpolator = d3Interpolate.interpolateObject(link.calculated_params, newPathParams);
            //   return t => {
            //     const interpolatedParams = paramsInterpolator(t);
            //     // save last params on each iteration so we can interpolate from last position upon
            //     // animation interrupt/cancel
            //     link.calculated_params = interpolatedParams;
            //     return composeLinkPath(interpolatedParams);
            //   };
            // })
            .attr('d', linkPath),
          exit => exit.remove()
        )
        .attr('thickness', d => d.width || 0)
        .call(join =>
          join.select('title')
            .text(linkTitle)
        );
    }),
    shareReplay(1)
  );

  renderedNodes$ = combineLatest([
    this.sankey.graph$,
    this.sankey.fontSize$
  ]).pipe(
    map(([{nodes}, fontSize]) => {
      const {
        updateNodeRect,
        sankey: {
          id,
          nodeColor,
          nodeLabel
        },
        updateNodeText
      } = this;

      return this.nodeSelection
        .data<Base['node']>(
          nodes.filter(
            // should no longer be an issue but leaving as sanity check
            // (if not satisfied visualisation brakes)
            n => n.sourceLinks.length + n.targetLinks.length > 0
          ),
          id
        )
        .join(
          enter => enter.append('g')
            .call(enterNode => updateNodeRect(enterNode.append('rect')))
            .call(this.attachNodeEvents)
            .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`)
            .call(enterNode =>
              updateNodeText(
                enterNode
                  .append('foreignObject')
                  .attr('width', 1)
                  .attr('height', 1)
                  .call(textGroup => {
                    textGroup.append('xmlns:div');
                  })
              )
            )
            .call(enterNode =>
              enterNode.append('title')
                .text(nodeLabel)
            ),
          // it was used in some very strage construct - hope it is not needed anymore
          // .call(e => this.enter.emit(e)),
          update => update
            .call(enterNode => {
              updateNodeRect(
                enterNode.select('rect')
                // todo: reenable when performance improves
                // .transition().duration(RELAYOUT_DURATION)
              );
              updateNodeText(
                enterNode.select('foreignObject')
                  .attr('text-anchor', 'end')
                // todo: reenable when performance improves
                // .transition().duration(RELAYOUT_DURATION)
              );
            })
            // todo: reenable when performance improves
            // .transition().duration(RELAYOUT_DURATION)
            .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`),
          exit => exit.remove()
        )
        .call(joined => {
          updateNodeRect(
            joined
              .select('rect')
              .style('fill', nodeColor as d3_ValueFn<any, Base['node'], string>)
          );
          joined.select('foreignObject')
            .call(textGroup => {
              textGroup.select('div')
                .text(this.sankey.nodeLabel);
            });
        });
    }),
    shareReplay(1)
  );

  /**
   * Run d3 lifecycle code to update DOM
   * @param graph: { links, nodes } to be rendered
   */
  updateDOM$ = combineLatest([
    this.renderedLinks$,
    this.renderedNodes$,
  ]).pipe(
    map(([linkSelection, nodeSelection]) => ({
      linkSelection,
      nodeSelection
    })),
    debug('updateDOM'),
    shareReplay({bufferSize: 1, refCount: true})
  );

  updateSearch$ = this.search.preprocessedMatches$.pipe(
    takeUntil(this.destroyed$),
    map(entities => groupBy(entities, 'type')),
    publish(matches$ => combineLatest([
      matches$.pipe(
        map(({[EntityType.Node]: nodes = []}) => (nodes as Match[]).map<SankeyId>(({id}) => id)),
        switchMap(ids => this.renderedNodes$.pipe(
            tap(renderedNodes => {
              if (isEmpty(ids)) {
                renderedNodes.attr('searched', undefined);
              } else {
                renderedNodes
                  .attr('searched', ({id}) => ids.includes(id))
                  .filter(({id}) => ids.includes(id))
                  .raise();
              }
            })
          )
        )
      ),
      matches$.pipe(
        map(({[EntityType.Link]: links = []}) => (links as Match[]).map<SankeyId>(({id}) => id)),
        switchMap(ids => this.renderedLinks$.pipe(
            tap(renderedLinks => {
              if (isEmpty(ids)) {
                renderedLinks.attr('searched', undefined);
              } else {
                renderedLinks
                  .attr('searched', ({id, originLink}: any) => ids.includes(id ?? originLink?.id))
                  .filter(({id, originLink}: any) => ids.includes(id ?? originLink?.id))
                  .raise();
              }
            })
          )
        )
      ),
      // matches$.pipe(
      //   map(({[EntityType.Trace]: traces = []}) => traces),
      //   updateAttr(this.renderedLinks$, 'searched', {
      //     // dont update other
      //     otherOnStart: null,
      //     // just delete property (don't set it to false)
      //     exit: s => s.attr('searched', undefined),
      //     accessor: (arr, link) => arr.some(trace => link.belongsToTrace(trace.id)),
      //   }),
      //   updateAttr(this.renderedNodes$, 'searched', {
      //     // dont update other
      //     otherOnStart: null,
      //     enter: s => s
      //       .attr('searched', true)
      //       .raise(),
      //     // just delete property (don't set it to false)
      //     exit: s => s.attr('searched', undefined),
      //     accessor: (arr, {id}) => arr.includes(id),
      //   })
      // )
    ])),
    debug('updateSearch')
  );

  lastHoveredLink$ = new Subject();
  lastHoveredNode$ = new Subject();

  hoverUpdate$ = combineLatest([
    this.lastHoveredLink$.pipe(
      throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
      switchMap(({data, element}) =>
        // raise link and it's siblings (same source and target)
        this.renderedLinks$.pipe(
          tap(linkSelection => {
            linkSelection
              .filter(({source, target}) => data.source === source && data.target === target)
              .sort((a, b) => Number(a === data))
              .raise();
          })
        )
      )
    ),
    this.lastHoveredNode$.pipe(
      throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
      switchMap(({data, element}) => {
        const {sourceLinks, targetLinks} = data;
        const links = sourceLinks.concat(targetLinks);
        // raise node and it's links
        return this.renderedLinks$.pipe(
          tap(linkSelection => {
            linkSelection
              .filter(link => links.includes(link))
              .raise();
            d3_select(element).raise();
          })
        );
      })
    )
  ]);

  // endregion


  // endregion

  @d3Callback
  updateNodeText(texts) {
    const {width} = this;
    return texts
      .attr('transform', ({x0, x1, y0, y1}) => `translate(${(x1 - x0) / 2}, ${(y1 - y0) / 2})`)
      .attr('label-anchor', ({x0}) => x0 < width / 2 ? 'right' : 'left');
  }

  initHover() {
    this.hoverUpdate$.pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  initSearch() {
    this.updateSearch$.pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  ngOnInit() {
    this.zoom = new Zoom(
      this.svg, {
        scaleExtent: [0.1, 8],
        extent: () => {
          const {x, y, width, height} = this.g.nativeElement.getBBox();
          return [[x, y], [x + width, y + height]];
        }
      });

    this.initSelection();
    this.initFocus();
    this.initSearch();
    this.initHover();
    this.initStateUpdate();

    this.updateDOM$.subscribe(() => {
    });
  }


  abstract initFocus();

  abstract initSelection();

  // Optional
  initStateUpdate() {
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

  ngAfterViewInit() {
    // attach zoom behaviour
    const {g, zoom} = this;
    const zoomContainer = d3_select(g.nativeElement);
    this.zoom.on$('zoom').subscribe(({transform}) => {
      zoomContainer.attr('transform', transform);
    });

    this.sankeySelection.on('click', () => {
      const e = d3_event;
      if (!e.target.__data__) {
        this.selection.reset();

        // events are consumed by d3_zoom recall mouse down/up on document to close possible popups
        document.dispatchEvent(new MouseEvent('mousedown'));
        document.dispatchEvent(new MouseEvent('mouseup'));
      }
    });
  }

  constrainedZoomTransform({width, height}, transform = zoomIdentity) {

  }

  zoomToFit(transition: boolean = true) {
    return this.viewBox$.pipe(
      first()
    ).toPromise().then(({width, height}) => {
      // @ts-ignore
      const [[x0, y0], [x1, y1]] = this.zoom.extent();
      const extentWidth = x1 - x0;
      const extentHeight = y1 - y0;
      const k = Math.min(width / extentWidth, height / extentHeight);
      const transform = zoomIdentity
        // Center in viewport
        .translate(width / 2, height / 2)
        // Scale (now on in scaled units)
        .scale(k)
        // Translate to center of extent
        .translate(-(x0 + extentWidth / 2), -(y0 + extentHeight / 2));
      // point which should be ~static during transition
      const p: [number, number] = [(x1 - x0) / 2, (y1 - y0) / 2];
      this.zoom.transform(transform, p, transition);
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }


  // region Events
  @d3Callback
  attachLinkEvents(d3Links) {
    d3Links
      .on('click', this.linkClick)
      .on('mouseover', this.pathMouseOver);
  }

  @d3EventCallback
  dragStart(element, delta, data) {
    assign(delta, {dx: 0, dy: 0});
    d3_select(element).raise();
  }

  @d3EventCallback
  drag(element, delta, data) {
    delta.dx += d3_event.dx;
    delta.dy += d3_event.dy;
    this.dragmove(element, data);
  }

  @d3EventCallback
  dragEnd(element, {dx, dy}, data) {
    // d3v5 does not include implementation for this
    if (Math.hypot(dx, dy) < 10) {
      return this.nodeClick(element, data);
    } else {
      this.updateController.modified(element, data);
    }
  }

  dragWithDeltaFactory(delta, calback) {
    return partial(calback, delta);
  }

  @d3Callback
  attachNodeEvents(d3Nodes) {
    const delta = {dx: 0, dy: 0};
    d3Nodes
      .on('mouseover', this.nodeMouseOver)
      .call(
        d3_drag()
          .on('start', this.dragWithDeltaFactory(delta, this.dragStart))
          .on('drag', this.dragWithDeltaFactory(delta, this.drag))
          .on('end', this.dragWithDeltaFactory(delta, this.dragEnd))
      );
  }

  @d3EventCallback
  linkClick(element, data) {
    return Promise.resolve(this.selection.toggleLink(data)).then(() =>
      Promise.resolve(this.clipboard.writeToClipboard(data.path)).then(() =>
          this.snackBar.open(
            `Path copied to clipboard`,
            undefined,
            {duration: 500},
          ),
        console.error
      )
    );
  }

  nodeClick(element, data) {
    return this.selection.toggleNode(data);
  }

  @d3EventCallback
  pathMouseOver(element, data) {
    return this.lastHoveredLink$.next({element, data});
  }

  @d3EventCallback
  nodeMouseOver(element, data) {
    return this.lastHoveredNode$.next({element, data});
  }


  // the function for moving the nodes
  dragmove(element, d) {
    const {
      id,
      linkPath$
    } = this.sankey;

    const nodeWidth = d.x1 - d.x0;
    const nodeHeight = d.y1 - d.y0;
    const newPosition = {
      x0: d.x0 + d3_event.dx,
      x1: d.x0 + d3_event.dx + nodeWidth,
      y0: d.y0 + d3_event.dy,
      y1: d.y0 + d3_event.dy + nodeHeight
    };
    Object.assign(d, newPosition);
    d3_select(element)
      .raise()
      .attr('transform', `translate(${d.x0},${d.y0})`);
    const relatedLinksIds = d.sourceLinks.concat(d.targetLinks).map(id);
    return linkPath$.pipe(
      switchMap(linkPath =>
        this.renderedLinks$.pipe(
          map(linkSelection => linkSelection
            .filter((...args) => relatedLinksIds.includes(id(...args)))
            .attr('d', linkPath)
            .raise()
          )
        )
      ),
      first()
    ).toPromise();
  }

  // endregion

  // Assign attr based on accessor and raise trueish results
  assignAttrAndRaise(selection, attr, accessor) {
    return selection
      // This technique fails badly
      // there is race condition between attr set and moving the node by raise call
      // .each(function(s) {
      //   // use each so we search traces only once
      //   const selected = accessor(s);
      //   const element = d3_select(this)
      //     .attr(attr, selected);
      //   if (selected) {
      //     element.raise();
      //   }
      // })
      .attr(attr, accessor)
      .filter(accessor)
      .call(e => e.raise());
  }

  // region Render

  updateNodeRect(rects) {
    return rects
      .attr('height', ({y1, y0}) => representativePositiveNumber(y1 - y0))
      .attr('width', ({x1, x0}) => x1 - x0);
  }

  // endregion
}
