import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { zoom as d3_zoom, zoomIdentity as d3_zoomIdentity } from 'd3-zoom';
import { select as d3_select, ValueFn as d3_ValueFn, Selection as d3_Selection, event as d3_event } from 'd3-selection';
import { drag as d3_drag } from 'd3-drag';
import { combineLatest } from 'rxjs';
import { map, switchMap, first, filter, tap } from 'rxjs/operators';
import { size } from 'lodash-es';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { createResizeObservable } from 'app/shared/rxjs/resize-observable';
import { SankeyLink, SankeyNode, SankeyId } from 'app/sankey/interfaces';

import { representativePositiveNumber } from '../utils/utils';
import { SankeySelectionService } from '../services/selection.service';
import { SankeySearchService } from '../services/search.service';
import { SankeyBaseOptions, SankeyBaseState } from '../base-views/interfaces';
import { EntityType } from '../utils/search/search-match';
import { SankeyAbstractAdvancedPanelComponent } from './advanced-panel.component';
import { LayoutService, DefaultLayoutService } from '../services/layout.service';

export class SankeyAbstractComponent implements AfterViewInit, OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: LayoutService<SankeyBaseOptions, SankeyBaseState>,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService
  ) {}

  // region D3Selection
  get linkSelection(): d3_Selection<any, SankeyLink, any, any> {
    // returns empty selection if DOM struct was not initialised
    return d3_select(this.links && this.links.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get nodeSelection(): d3_Selection<any, SankeyNode, any, any> {
    // returns empty selection if DOM struct was not initialised
    return d3_select(this.nodes && this.nodes.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get sankeySelection() {
    return d3_select(this.svg && this.svg.nativeElement);
  }

  get updateNodeText() {
    // noinspection JSUnusedLocalSymbols
    const {width} = this.sankey.horizontal;
    const {fontSize} = this.sankey;
    return texts => texts
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

  // region Properties (&Accessors)
  readonly MARGIN = 10;

  // endregion

  focusedEntity$ = this.sankey.dataToRender$.pipe(
    switchMap(({nodes, links}) => this.search.searchFocus$.pipe(
      map(({type, id}) => {
        switch (type) {
          case EntityType.Node:
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            return nodes.find(({_id}) => _id == id);
          case EntityType.Link:
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            return links.find(({_id}) => _id == id);
          default:
            return null;
        }
      })
    ))
  );

  margin = {
    top: this.MARGIN,
    right: this.MARGIN,
    bottom: this.MARGIN,
    left: this.MARGIN
  };
  resizeObserver;
  size;
  zoom;
  dragging = false;


  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('nodes', {static: false}) nodes!: ElementRef;
  @ViewChild('links', {static: false}) links!: ElementRef;

  // @Output() backgroundClicked = new EventEmitter();
  // @Output() enter = new EventEmitter();
  //
  // @Input() normalizeLinks = true;
  // @Input() selectedNodes = new Set<object>();
  // @Input() searchedEntities = [];
  // @Input() focusedNode;
  // @Input() selectedLinks = new Set<object>();

  static updateTextShadow(_) {
    // this contains ref to textGroup
    // @ts-ignore
    const [shadow, text] = this.children;
    const {x, y, width, height} = text.getBBox();
    d3_select(shadow)
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height);
  }

  initComopnent() {
    this.linkClick = this.linkClick.bind(this);
    this.nodeClick = this.nodeClick.bind(this);
    this.nodeMouseOver = this.nodeMouseOver.bind(this);
    this.pathMouseOver = this.pathMouseOver.bind(this);
    this.nodeMouseOut = this.nodeMouseOut.bind(this);
    this.pathMouseOut = this.pathMouseOut.bind(this);
    this.dragmove = this.dragmove.bind(this);
    this.attachLinkEvents = this.attachLinkEvents.bind(this);
    this.attachNodeEvents = this.attachNodeEvents.bind(this);

    this.zoom = d3_zoom()
      .scaleExtent([0.1, 8]);

    this.sankey.dataToRender$.subscribe(data => {
      this.updateDOM(data);
    });

    this.initSelection();

    this.search.preprocessedMatches$.subscribe(entities => {
      if (entities.length) {
        this.searchNodes(new Set(entities.filter(({type}) => EntityType.Node).map(({id}) => id)));
        this.searchLinks(new Set(entities.filter(({type}) => EntityType.Link).map(({id}) => id)));
      } else {
        this.stopSearchNodes();
        this.stopSearchLinks();
      }
    });
    this.initFocus();
  }

  initFocus() {
    throw new Error('Not implemented');
  }

  initSelection() {
    throw new Error('Method not implemented.');
  }

  panToEntity(e) {
    if (e) {
      this.sankeySelection.transition().call(
        this.zoom.translateTo,
        // x
        (e._x0 !== undefined) ?
          (e._x0 + e._x1) / 2 :
          (e._source._x1 + e._target._x0) / 2,
        // y
        (e._y0 + e._y1) / 2
      );
    }
  }

  // endregion

  ngAfterViewInit() {
    // attach zoom behaviour
    const {g, zoom} = this;
    const zoomContainer = d3_select(g.nativeElement);
    zoom.on('zoom', _ => zoomContainer.attr('transform', d3_event.transform));

    this.sankeySelection.on('click', () => {
      const e = d3_event;
      if (!e.target.__data__) {
        // todo
        // this.backgroundClicked.emit();

        // events are consumed by d3_zoom recall mouse down/up on document to close possible popups
        document.dispatchEvent(new MouseEvent('mousedown'));
        document.dispatchEvent(new MouseEvent('mouseup'));
      }
    });

    this.attachResizeObserver();
  }

  attachResizeObserver() {
    this.zone.runOutsideAngular(() =>
      // resize and listen to future resize events
      this.resizeObserver = createResizeObservable(this.wrapper.nativeElement)
        .subscribe(rect =>
          this.zone.run(() => this.onResize(rect))
        )
    );
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.unsubscribe();
      delete this.resizeObserver;
    }
  }

  // endregion

  // region Graph sizing
  onResize({width, height}) {
    const {zoom, margin} = this;
    const extentX = width - margin.right;
    const extentY = height - margin.bottom;

    // Get the svg element and update
    this.sankeySelection
      .attr('width', width)
      .attr('height', height)
      .call(
        zoom
          .extent([[0, 0], [width, height]])
        // .translateExtent([[0, 0], [width, height]])
      );

    this.sankey.setExtent({
      x0: margin.left,
      x1: extentX,
      y0: margin.top,
      y1: extentY
    });
    // todo
    // const [prevInnerWidth, prevInnerHeight] = this.sankey.size;
    // this.sankey.extent = [[margin.left, margin.top], [extentX, extentY]];
    // const [innerWidth, innerHeight] = this.sankey.size;
    //
    // this.resized.emit({width: innerWidth, height: innerHeight});
    //
    // const parsedData = innerHeight / prevInnerHeight === 1 ?
    //   this.scaleLayout(this.data, innerWidth / prevInnerWidth) :
    //   this.updateLayout(this.data);
    // return parsedData.then(data => this.updateDOM(data));
  }

  // endregion

  // region Events
  attachLinkEvents(d3Links) {
    const {linkClick, pathMouseOver, pathMouseOut} = this;
    d3Links
      .on('click', function(data) {
        return linkClick(this, data);
      })
      .on('mouseover', function(data) {
        return pathMouseOver(this, data);
      })
      .on('mouseout', function(data) {
        return pathMouseOut(this, data);
      });
  }

  attachNodeEvents(d3Nodes) {
    const {dragmove, nodeClick, nodeMouseOver, nodeMouseOut} = this;
    let dx = 0;
    let dy = 0;
    d3Nodes
      .on('mouseover', function(data) {
        return nodeMouseOver(this, data);
      })
      .on('mouseout', function(data) {
        return nodeMouseOut(this, data);
      })
      .call(
        d3_drag()
          .on('start', function() {
            dx = 0;
            dy = 0;
            d3_select(this).raise();
          })
          .on('drag', function(d) {
            dx += d3_event.dx;
            dy += d3_event.dy;
            dragmove(this, d);
          })
          .on('end', function(d) {
            // d3v5 does not include implementation for this
            if (Math.hypot(dx, dy) < 10) {
              return nodeClick(this, d);
            }
          })
      );
  }

  linkClick(element, data) {
    return this.selection.toggleLink(data).toPromise().then(() =>
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
    return this.selection.toggleNode(data).toPromise();
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered path.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  async pathMouseOver(element, data) {
    throw new Error('Not implemented');
  }

  /**
   * Callback that undims all nodes/links.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  async pathMouseOut(element, data) {
    throw new Error('Not implemented');
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered node.
   * styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  async nodeMouseOver(element, data) {
    this.highlightNode(element);
  }

  /**
   * Callback that undims all nodes/links. Also unsets hover styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  async nodeMouseOut(element, data) {
    throw new Error('Not implemented');
  }

  scaleZoom(scaleBy) {
    // @ts-ignore
    this.sankeySelection.transition().call(this.zoom.scaleBy, scaleBy);
  }

  // noinspection JSUnusedGlobalSymbols
  resetZoom() {
    // it is used by its parent
    this.sankeySelection.call(this.zoom.transform, d3_zoomIdentity);
  }

  // the function for moving the nodes
  dragmove(element, d) {
    const {
      id,
      linkPath
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
    this.linkSelection
      .filter((...args) => relatedLinksIds.includes(id(...args)))
      .attr('d', linkPath);
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

  /**
   * Removes the `selected` property from all nodes on the canvas.
   */
  deselectNodes() {
    this.nodeSelection
      .attr('selected', undefined);
  }

  /**
   * Removes the `selected` property from all links on the canvas.
   */
  deselectLinks() {
    this.linkSelection
      .attr('selected', undefined);
  }

  // endregion

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
      .filter(l => linkIdxs.has(l._id));
    // .raise();
  }

  stopSearchLinks() {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('searched', undefined);
  }

  // endregion

  // region Focus
  focusNode(nodeId: SankeyId) {
    const {nodeLabel} = this.sankey;
    const selection = this.nodeSelection
      // tslint:disable-next-line:triple-equals
      .filter(({_id}) => _id == nodeId)
      .raise()
      .attr('focused', true)
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(nodeLabel);
      });

    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  unFocusNode(nodeId: SankeyNode['_id']) {
    const {nodeLabelShort} = this.sankey;
    const selection = this.nodeSelection
      .attr('focused', undefined)
      // tslint:disable-next-line:triple-equals
      .filter(({_id}) => _id == nodeId)
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(nodeLabelShort);
      });

    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  focusLink(linkId: SankeyId) {
    this.linkSelection
      // tslint:disable-next-line:triple-equals
      .filter(({_id}) => _id == linkId)
      .raise()
      .attr('focused', true);
  }

  // noinspection JSUnusedLocalSymbols
  unFocusLink(linkId: SankeyId) {
    this.linkSelection
      .attr('focused', undefined);
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
    throw new Error('Not implemented');
  }

  unhighlightNode(element) {
    const {sankey: {nodeLabelShort, nodeLabelShouldBeShorted}} = this;

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

    return this.search.preprocessedMatches$.pipe(
      first(),
      // resize shadow back to shorter test when it is used as search result
      filter(matches => size(matches) > 0),
      tap(matches =>
        // postpone so the size is known
        requestAnimationFrame(_ =>
          selection.select('g')
            .each(SankeyAbstractComponent.updateTextShadow)
        )
      ),
    ).toPromise();
  }

  // todo
  //         if (isObject(data._precomputedLayout)) {
  //         const [currentWidth, currentHeight] = this.sankey.size;
  //         const {width = currentWidth, height = currentHeight} = data._precomputedLayout;
  //         this.zoom.scaleTo(
  //           this.sankeySelection,
  //           Math.min(
  //             currentWidth / width,
  //             currentHeight / height
  //           ),
  //           [0, 0]
  //         );
  //       }


  // region Render

  updateNodeRect = rects => rects
    .attr('height', ({_y1, _y0}) => representativePositiveNumber(_y1 - _y0))
    .attr('width', ({_x1, _x0}) => _x1 - _x0)
    .attr('width', ({_x1, _x0}) => _x1 - _x0)

  /**
   * Run d3 lifecycle code to update DOM
   * @param graph: { links, nodes } to be rendered
   */
  updateDOM(graph) {
    // noinspection JSUnusedLocalSymbols
    const {
      updateNodeRect, updateNodeText,
      sankey: {
        id,
        nodeColor,
        nodeTitle,
        linkTitle,
        nodeLabel,
        nodeLabelShort,
        linkColor,
        linkBorder,
        linkPath,
        circular
      }
    } = this;

    const layerWidth = ({_source, _target}) => Math.abs(_target._layer - _source._layer);

    this.linkSelection
      .data<SankeyLink>(graph.links.sort((a, b) => layerWidth(b) - layerWidth(a)), id)
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

    this.nodeSelection
      .data<SankeyNode>(
        graph.nodes.filter(
          // should no longer be an issue but leaving as sanity check
          // (if not satisfied visualisation brakes)
          n => n._sourceLinks.length + n._targetLinks.length > 0
        ),
        id
      )
      .join(
        enter => enter.append('g')
          .call(enterNode =>
            updateNodeRect(
              enterNode.append('rect')
            )
          )
          .call(this.attachNodeEvents)
          .attr('transform', ({_x0, _y0}) => `translate(${_x0},${_y0})`)
          .call(enterNode =>
            updateNodeText(
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
  }
  // endregion
}
