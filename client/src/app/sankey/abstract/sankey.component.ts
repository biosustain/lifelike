import { AfterViewInit, ElementRef, OnDestroy, ViewChild, NgZone, OnInit, Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select, ValueFn as d3_ValueFn, Selection as d3_Selection, event as d3_event } from 'd3-selection';
import { drag as d3_drag } from 'd3-drag';
import { map, switchMap, first, filter, tap, publish, takeUntil, shareReplay } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { assign, partial, groupBy } from 'lodash-es';
import { zoomIdentity } from 'd3';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { createResizeObservable } from 'app/shared/rxjs/resize-observable';
import { SankeyLink, SankeyNode, SankeyId } from 'app/sankey/interfaces';
import { debug } from 'app/shared/rxjs/debug';
import { d3Callback, d3EventCallback } from 'app/shared/utils/d3';
import { isNotEmpty } from 'app/shared/utils';

import { representativePositiveNumber } from '../utils';
import { SankeySelectionService } from '../services/selection.service';
import { SankeySearchService } from '../services/search.service';
import { SankeyBaseOptions, SankeyBaseState } from '../base-views/interfaces';
import { LayoutService } from '../services/layout.service';
import { updateAttr, updateSingular } from '../utils/rxjs';
import { Zoom } from '../utils/zoom';
import { NotImplemented } from '../utils/error';
import { Match, EntityType } from '../interfaces/search';

export type DefaultSankeyAbstractComponent = SankeyAbstractComponent<SankeyBaseOptions, SankeyBaseState>;

@Component({ templateUrl: './sankey.component.svg' })
export class SankeyAbstractComponent<Options extends SankeyBaseOptions, State extends SankeyBaseState> implements OnInit, AfterViewInit,
  OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: LayoutService<Options, State>,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService
  ) {
  }

  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return d3_select(this.links.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get nodeSelection(): d3_Selection<any, SankeyNode, any, any> {
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

  focusedNode$ = this.sankey.graph$.pipe(
    switchMap(({nodes}) =>
      this.sankey.nodeLabel$.pipe(
        switchMap(({nodeLabelShort}) => this.search.searchFocus$.pipe(
          map(({type, id}) =>
            type === EntityType.Node &&
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            nodes.find(({_id}) => _id == id)
          ),
          updateSingular(this.renderedNodes$, {
            enter: s => s
              .attr('focused', true)
              .call(node => node
                .select('g')
                .call(textGroup => {
                  textGroup
                    .select('text')
                    .text(this.sankey.nodeLabel);
                  // postpone so the size is known
                  requestAnimationFrame(() => {
                    textGroup
                      .each(SankeyAbstractComponent.updateTextShadow);
                  });
                })
              )
              .raise(),
            exit: s => s
              .attr('focused', false)
              .select('g')
              .call(textGroup => {
                textGroup
                  .select('text')
                  .text(nodeLabelShort);
                // postpone so the size is known
                requestAnimationFrame(() => {
                  textGroup
                    .each(SankeyAbstractComponent.updateTextShadow);
                });
              })
          }),
        )),
        tap(node => node && this.panToNode(node)),
      )
    ));

  readonly MARGIN = 10;

  margin = {
    top: this.MARGIN,
    right: this.MARGIN,
    bottom: this.MARGIN,
    left: this.MARGIN
  };

  destroy$ = new Subject();

  @ViewChild('svg', {static: true}) svg!: ElementRef;
  @ViewChild('g', {static: true}) g!: ElementRef;
  @ViewChild('nodes', {static: true}) nodes!: ElementRef;
  @ViewChild('links', {static: true}) links!: ElementRef;

  zoom: Zoom<SVGElement, number>;

  width: number;

  // resize and listen to future resize events
  resize$ = createResizeObservable(this.wrapper.nativeElement)
    .subscribe(rect => this.onResize(rect));

  renderedLinks$ = combineLatest([
    this.sankey.graph$,
    this.sankey.linkPath$
  ]).pipe(
    map(([{links}, linkPath]) => {
      const {
        sankey: {
          id,
          linkTitle,
          linkColor,
          linkBorder,
          circular
        }
      } = this;
      const layerWidth = ({_source, _target}) => Math.abs(_target._layer - _source._layer);
      return this.linkSelection
        .data<SankeyLink>(links.sort((a, b) => layerWidth(b) - layerWidth(a)), id)
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
            //   const paramsInterpolator = d3Interpolate.interpolateObject(link._calculated_params, newPathParams);
            //   return t => {
            //     const interpolatedParams = paramsInterpolator(t);
            //     // save last params on each iteration so we can interpolate from last position upon
            //     // animation interrupt/cancel
            //     link._calculated_params = interpolatedParams;
            //     return composeLinkPath(interpolatedParams);
            //   };
            // })
            .attr('d', linkPath),
          exit => exit.remove()
        )
        .style('fill', linkColor as any)
        .style('stroke', linkBorder as any)
        .attr('thickness', d => d._width || 0)
        .call(join =>
          join.select('title')
            .text(linkTitle)
        );
    })
  );

  renderedNodes$ = combineLatest([
    this.sankey.graph$,
    this.sankey.fontSize$,
    this.sankey.nodeLabel$
  ]).pipe(
    map(([{nodes}, fontSize, {nodeLabelShort}]) => {
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
        .data<SankeyNode>(
          nodes.filter(
            // should no longer be an issue but leaving as sanity check
            // (if not satisfied visualisation brakes)
            n => n._sourceLinks.length + n._targetLinks.length > 0
          ),
          id
        )
        .join(
          enter => enter.append('g')
            .call(enterNode => updateNodeRect(enterNode.append('rect')))
            .call(this.attachNodeEvents)
            .attr('transform', ({_x0, _y0}) => `translate(${_x0},${_y0})`)
            .call(enterNode =>
              updateNodeText(
                fontSize,
                enterNode
                  .append('g')
                  .call(textGroup => {
                    textGroup.append('rect')
                      .classed('text-shadow', true);
                    textGroup.append('text');
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
                fontSize,
                enterNode.select('g')
                  .attr('dy', '0.35em')
                  .attr('text-anchor', 'end')
                // todo: reenable when performance improves
                // .transition().duration(RELAYOUT_DURATION)
              );
            })
            // todo: reenable when performance improves
            // .transition().duration(RELAYOUT_DURATION)
            .attr('transform', ({_x0, _y0}) => `translate(${_x0},${_y0})`),
          exit => exit.remove()
        )
        .call(joined => {
          updateNodeRect(
            joined
              .select('rect')
              .style('fill', nodeColor as d3_ValueFn<any, SankeyNode, string>)
          );
          joined.select('g')
            .call(textGroup => {
              textGroup.select('text')
                .text(nodeLabelShort);
            });
        });
    })
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
    map(entities => groupBy(entities, 'type')),
    publish(matches$ => combineLatest([
      matches$.pipe(
        map(({[EntityType.Node]: nodes = []}) => (nodes as Match[]).map<SankeyId>(({id}) => id)),
        updateAttr(this.renderedNodes$, 'searched', {
          // dont update other
          otherOnStart: null,
          // just delete property (don't set it to false)
          exit: s => s.attr('searched', undefined),
          accessor: (arr, {_id}) => arr.includes(_id),
        })
      ),
      matches$.pipe(
        map(({[EntityType.Link]: links = []}) => (links as Match[]).map<SankeyId>(({id}) => id)),
        updateAttr(this.renderedLinks$, 'searched', {
          // dont update other
          otherOnStart: null,
          // just delete property (don't set it to false)
          exit: s => s.attr('searched', undefined),
          accessor: (arr, {_id}) => arr.includes(_id),
        })
      )
    ]))
  );

  // endregion

  static updateTextShadow(this: SVGElement, _) {
    // this contains ref to textGroup
    const [shadow, text] = this.children as any as [SVGRectElement, SVGTextElement];
    const {x, y, width, height} = text.getBBox();
    d3_select(shadow)
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height);
  }

  @d3Callback
  extendNodeLabel() {
    const {nodeLabel} = this.sankey;
    return textGroup => this.sankey.nodeLabel$.pipe(
      first(),
      tap(({nodeLabelShort, nodeLabelShouldBeShorted}) => {
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
      })
    ).toPromise();
  }

  @d3Callback
  updateNodeText(fontSize, texts) {
    const {width} = this;
    return texts
      .attr('transform', ({_x0, _x1, _y0, _y1}) =>
        `translate(${_x0 < width / 2 ? (_x1 - _x0) + 6 : -6} ${(_y1 - _y0) / 2})`
      )
      .attr('text-anchor', 'end')
      .attr('font-size', fontSize)
      .call(textGroup =>
        textGroup.select('text')
          .attr('dy', '0.35em')
      )
      .filter(({_x0}) => _x0 < width / 2)
      .attr('text-anchor', 'start')
      .attr('font-size', fontSize);
  }

  initSearch() {
    this.updateSearch$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngOnInit() {
    this.zoom = new Zoom(this.svg, {scaleExtent: [0.1, 8]});
    this.sankey.zoomAdjustment$.subscribe(({zoom, x0 = 0, y0 = 0}) => {
      this.zoom.initialTransform = zoomIdentity.translate(0, 0).scale(zoom).translate(x0, y0);
    });

    this.updateDOM$.subscribe(() => {});

    this.initSelection();
    this.initFocus();
    this.initSearch();
  }


  initFocus() {
    throw new NotImplemented();
  }

  initSelection() {
    throw new NotImplemented();
  }

  panToNode({_x0, _x1, _y0, _y1}) {
    this.zoom.translateTo(
      // x
      (_x0 + _x1) / 2,
      // y
      (_y0 + _y1) / 2,
      undefined,
      true
    );
  }

  // endregion

  ngAfterViewInit() {
    // attach zoom behaviour
    const {g, zoom} = this;
    const zoomContainer = d3_select(g.nativeElement);
    this.zoom.on$('zoom').subscribe(() => zoomContainer.attr('transform', d3_event.transform));

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

  ngOnDestroy() {
    this.destroy$.next();
    if (this.resize$) {
      this.resize$.unsubscribe();
      delete this.resize$;
    }
  }

  // region Graph sizing
  onResize({width, height}) {
    this.width = width;
    const {margin} = this;
    const extentX = width - margin.right;
    const extentY = height - margin.bottom;

    this.zoom.extent = [[0, 0], [width, height]];
    // Get the svg element and update
    this.sankeySelection
      .attr('width', width)
      .attr('height', height);

    this.sankey.setExtent({
      x0: margin.left,
      x1: extentX,
      y0: margin.top,
      y1: extentY
    });
  }

  // endregion

  // region Events
  @d3Callback
  attachLinkEvents(d3Links) {
    d3Links
      .on('click', this.linkClick)
      .on('mouseover', this.pathMouseOver)
      .on('mouseout', this.pathMouseOut);
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
      .on('mouseout', this.nodeMouseOut)
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
      this.clipboard.writeToClipboard(data.path).then(() =>
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

  /**
   * Callback that dims any nodes/links not connected through the hovered path.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  @d3EventCallback
  async pathMouseOver(element, data) {
    throw new NotImplemented();
  }

  /**
   * Callback that undims all nodes/links.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  @d3EventCallback
  async pathMouseOut(element, data) {
    throw new NotImplemented();
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered node.
   * styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  @d3EventCallback
  async nodeMouseOver(element, data) {
    this.highlightNode(element);
  }

  /**
   * Callback that undims all nodes/links. Also unsets hover styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  @d3EventCallback
  async nodeMouseOut(element, data) {
    throw new NotImplemented();
  }

  // the function for moving the nodes
  dragmove(element, d) {
    const {
      id,
      linkPath$
    } = this.sankey;

    const nodeWidth = d._x1 - d._x0;
    const nodeHeight = d._y1 - d._y0;
    const newPosition = {
      _x0: d._x0 + d3_event.dx,
      _x1: d._x0 + d3_event.dx + nodeWidth,
      _y0: d._y0 + d3_event.dy,
      _y1: d._y0 + d3_event.dy + nodeHeight
    };
    Object.assign(d, newPosition);
    d3_select(element)
      .raise()
      .attr('transform', `translate(${d._x0},${d._y0})`);
    const relatedLinksIds = d._sourceLinks.concat(d._targetLinks).map(id);
    return linkPath$.pipe(
      switchMap(linkPath =>
        this.renderedLinks$.pipe(
          map(linkSelection => linkSelection
            .filter((...args) => relatedLinksIds.includes(id(...args)))
            .attr('d', linkPath)
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

  // region Search
  searchNodes(nodeIdxs: Set<string | number>) {
    const selection = this.nodeSelection
      .attr('searched', n => nodeIdxs.has(n._id))
      .filter(n => nodeIdxs.has(n._id))
      // .raise()
      .select('g');

    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  stopSearchNodes() {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('searched', undefined);
  }

  searchLinks(linkIdxs: Set<SankeyLink['_id']>) {
    this.linkSelection
      .attr('searched', l => linkIdxs.has(l._id))
      .filter(l => linkIdxs.has(l._id))
      .raise();
  }

  stopSearchLinks() {
    return this.linkSelection
      .attr('searched', undefined);
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

  unhighlightLinks() {
    this.linkSelection
      .attr('highlighted', undefined);
  }

  unhighlightNodes() {
    this.nodeSelection
      .attr('highlighted', undefined);
  }

  // endregion

  highlightNode(element) {
    throw new NotImplemented();
  }

  unhighlightNode(element) {
    return this.sankey.nodeLabel$.pipe(
      map(({nodeLabelShort, nodeLabelShouldBeShorted}) => {
        const selection = d3_select(element);
        selection.select('text')
          .filter(nodeLabelShouldBeShorted)
          // todo: reenable when performance improves
          // .transition().duration(RELAYOUT_DURATION)
          // .textTween(n => {
          //   const label = nodeLabelAccessor(n);
          //   const length = label.length;
          //   const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
          //   return t => (label.slice(0, interpolator(t)) + '...').slice(0, length);
          // });
          .text(nodeLabelShort);
        return selection;
      }),
      switchMap(selection => this.search.preprocessedMatches$.pipe(
          first(),
          // resize shadow back to shorter test when it is used as search result
          filter(isNotEmpty),
          tap(matches =>
            // postpone so the size is known
            requestAnimationFrame(_ =>
              (selection as any).select('g')
                .each(SankeyAbstractComponent.updateTextShadow)
            )
          ),
        )
      ),
      first()
    ).toPromise();
  }

  // region Render

  updateNodeRect(rects) {
    return rects
      .attr('height', ({_y1, _y0}) => representativePositiveNumber(_y1 - _y0))
      .attr('width', ({_x1, _x0}) => _x1 - _x0)
      .attr('width', ({_x1, _x0}) => _x1 - _x0);
  }

  // endregion
}
