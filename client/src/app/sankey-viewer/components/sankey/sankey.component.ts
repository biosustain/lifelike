import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  EventEmitter,
  Output,
  ViewEncapsulation,
  OnInit
} from '@angular/core';

import * as d3 from 'd3';
import * as d3Sankey from 'd3-sankey';
import * as d3Interpolate from 'd3-interpolate';
import {
  clamp,
  SankeyGraph,
  createResizeObserver,
  layerWidth,
  composeLinkPath,
  calculateLinkPathParams,
  shortNodeText,
  nodeLabelAccessor,
  INITIALLY_SHOWN_CHARS,
  RELAYOUT_DURATION,
  representativePositiveNumber
} from './utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-sankey',
  templateUrl: './sankey.component.html',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() set timeInterval(ti) {
    if (this.sankey) {
      this._timeInterval = ti;
      this.sankey.timeInterval(ti);
    }
  }

  constructor(
    private elRef: ElementRef,
    private clipboard: ClipboardService,
    private readonly snackBar: MatSnackBar,
    private readonly domSanitizer: DomSanitizer
  ) {
    this.sankey = d3Sankey.sankey()
      .nodeId(n => n.id)
      .nodePadding(10)
      // .nodePaddingRatio(0.1)
      .linkSort((a, b) =>
        (b.source.index - a.source.index) ||
        (b.target.index - a.target.index) ||
        (b.trace_group - a.trace_group)
      )
      .nodeSort((a, b) =>
        (b.depth - a.depth) ||
        (b.index - a.index)
      )
      .nodeAlign(d3Sankey.sankeyRight)
      .nodeWidth(10);
    this.uiState = new BehaviorSubject({panX: 0, panY: 0, zoom: 1});

    this.linkClick = this.linkClick.bind(this);
    this.nodeClick = this.nodeClick.bind(this);
    this.nodeMouseOver = this.nodeMouseOver.bind(this);
    this.pathMouseOver = this.pathMouseOver.bind(this);
    this.nodeMouseOut = this.nodeMouseOut.bind(this);
    this.pathMouseOut = this.pathMouseOut.bind(this);
    this.dragmove = this.dragmove.bind(this);


    this.zoom = d3.zoom()
      .scaleExtent([0.1, 8]);
  }

  @Input('data') set data(data) {
    this._data = {...data} as SankeyGraph;
    if (this.svg) {
      this.updateLayout(this._data).then(d => this.updateDOM(d));
    }
  }

  get data() {
    return this._data;
  }

  get updateNodeText() {
    const [width, _height] = this.sankey.size();
    return texts => texts
      .attr('x', _ => -6)
      .attr('y', ({y0, y1}) => (y1 - y0) / 2)
      .filter(({x0}) => x0 < width / 2)
      .attr('x', ({x0, x1}) => (x1 - x0) + 6)
      .attr('text-anchor', 'start');
  }

  @Output() nodeClicked = new EventEmitter();
  @Output() linkClicked = new EventEmitter();

  @ViewChild('popover', {static: false}) public popover: NgbPopover;
  @ViewChild('popoverAnchor', {static: false}) public popoverAnchor;

  viewTransformation;

  @ViewChild('wrapper', {static: false}) wrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('nodes', {static: false}) nodes!: ElementRef;
  @ViewChild('links', {static: false}) links!: ElementRef;
  @Output() enter = new EventEmitter();

  private _data: SankeyGraph = {} as SankeyGraph;

  MARGIN = 10;

  margin = {
    top: this.MARGIN,
    right: this.MARGIN,
    bottom: this.MARGIN,
    left: this.MARGIN
  };

  MIN_FONT = 12;
  MAX_FONT = 48;

  private readonly sankey: any;
  resizeObserver: any;

  private _timeInterval = Infinity;

  selected;
  uiState;
  pan;
  size;

  d3links;

  debounceDragRelayout;

  zoom;
  dragging = false;


  getLinkDetails({trace, trace_group, folded, description, source, target, ...details}) {
    return JSON.stringify(details, null, 2);
  }

  calculateNextUIState({deltaX = 0, deltaY = 0, zoomDelta = 0}) {
    const {uiState: {value: {zoom, panX, panY}}, size: {width, height}} = this;
    const newZoom = clamp(1, 10)(zoom + zoomDelta);
    return {
      panX: clamp(0, width * (newZoom - 1))(panX + deltaX),
      panY: clamp(0, height * (newZoom - 1))(panY + deltaY),
      zoom: newZoom
    };
  }

  ngOnInit() {
    this.uiState.subscribe(status =>
      this.viewTransformation = this.domSanitizer.bypassSecurityTrustStyle(
        'translate(' + -status.panX + 'px, ' + -status.panY + 'px)' + ' scale(' + status.zoom + ')'
      )
    );
  }

  ngAfterViewInit() {
    const {width, height} = this.size = this.getCloudSvgDimensions();

    // attach zoom behaviour
    const {g, zoom} = this;
    const zoomContainer = d3.select(g.nativeElement);
    zoom.on('zoom', _ => zoomContainer.attr('transform', d3.event.transform));

    // resize and listen to future resize events
    this.onResize(width, height).then(_ => {
      this.resizeObserver = createResizeObserver(this.onResize.bind(this), this.wrapper.nativeElement);
    });
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
    this.uiState.unsubscribe();
    delete this.resizeObserver;
  }

  onResize(width, height) {
    const {zoom, margin} = this;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Get the svg element and update
    d3.select(this.svg.nativeElement)
      .attr('width', width)
      .attr('height', height)
      .call(
        zoom
          .extent([[0, 0], [width, height]])
          // .translateExtent([[0, 0], [width, height]])
      );

    this.sankey.extent([[margin.left, margin.top], [innerWidth, innerHeight]]);

    return this.updateLayout(this.data).then(this.updateDOM.bind(this));
  }

  getFontSize(normSize) {
    return this.MIN_FONT + (normSize || 0) * (this.MAX_FONT - this.MIN_FONT);
  }

  /**
   * Draws a word cloud with the given FilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of FilterEntity data
   */
  updateLayout(data) {
    return new Promise(resolve => {
        // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
        const a = this.sankey(data);
        resolve(a);
      }
    );
  }


  /**
   * Generates the width/height for the word cloud svg element. Uses the size of the wrapper element, minus a fixed margin. For example,
   * if the parent is 600px x 600px, and our margin is 10px, the size of the word cloud svg will be 580px x 580px.
   */
  private getCloudSvgDimensions() {
    const wrapper = this.wrapper.nativeElement;
    const {
      margin
    } = this;
    return {
      width: wrapper.offsetWidth - margin.left - margin.right,
      height: wrapper.offsetHeight - margin.top - margin.bottom
    };
  }

  linkClick(element, data, _eventId, _links, ..._rest) {
    this.linkClicked.emit(data);
    this.selected = data;
    this.clipboard.writeToClipboard(data.path).then(_ =>
      this.snackBar.open(
        `Path copied to clipboard`,
        undefined,
        {duration: 500},
      )
    );

    // this.showPopOverForSVGElement(element, {link: data});
  }

  nodeClick(element, data, _eventId, _links, ..._rest) {
    this.nodeClicked.emit(data);
    // if (element) {
    //   this.showPopOverForSVGElement(element, {node: data});
    // }
  }

  showPopOverForSVGElement(element, context) {
    const bbox = element.getBBox();
    if (this.popover.isOpen()) {
      this.popover.close();
    }
    const popoverAnchorStyle = this.popoverAnchor.nativeElement.style;
    popoverAnchorStyle.left = bbox.x + 'px';
    popoverAnchorStyle.top = bbox.y + 'px';
    popoverAnchorStyle.width = bbox.width + 'px';
    popoverAnchorStyle.height = bbox.height + 'px';
    this.popover.open(context);
  }

  pathMouseOver(_element, data, _eventId, _links, ..._rest) {
    d3.select(this.links.nativeElement)
      .selectAll('path')
      .style('opacity', ({schemaClass}) => schemaClass === data.schemaClass ? 1 : 0.35);
  }

  pathMouseOut(_element, _data, _eventId, _links, ..._rest) {
    d3.select(this.links.nativeElement)
      .selectAll('path')
      .style('opacity', 0.45);
  }

  nodeMouseOver(element, data, _eventId, _links, ..._rest) {
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .style('opacity', ({color}) => color === data.color ? 0.45 : 0.35);
    d3.select(element).select('text')
      .text(shortNodeText)
      .filter(n => INITIALLY_SHOWN_CHARS < nodeLabelAccessor(n).length)
      .transition().duration(RELAYOUT_DURATION)
      .textTween(n => {
        const displayName = nodeLabelAccessor(n);
        const length = displayName.length;
        const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
        return t => t === 1 ? displayName :
          (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
      });
  }

  nodeMouseOut(element, _data, _eventId, _links, ..._rest) {
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .style('opacity', 1);
    d3.select(element).select('text')
      .text(shortNodeText)
      .filter(n => INITIALLY_SHOWN_CHARS < nodeLabelAccessor(n).length)
      .transition().duration(RELAYOUT_DURATION)
      .textTween(n => {
        const displayName = nodeLabelAccessor(n);
        const length = displayName.length;
        const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
        return t => (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
      });
  }

  // the function for moving the nodes
  dragmove(element, d) {
    const nodeWidth = d.x1 - d.x0;
    const nodeHeight = d.y1 - d.y0;
    const newPosition = {
      x0: d.x0 + d3.event.dx,
      x1: d.x0 + d3.event.dx + nodeWidth,
      y0: d.y0 + d3.event.dy,
      y1: d.y0 + d3.event.dy + nodeHeight
    };
    Object.assign(d, newPosition);
    d3.select(element).raise().attr('transform', `translate(${d.x0},${d.y0})`);
    const relatedLinksIds = d.sourceLinks.concat(d.targetLinks).map(({id}) => id);
    d3.select(this.links.nativeElement)
      .selectAll('path')
      .filter(({id}) => relatedLinksIds.includes(id))
      .attr('d', link => {
        const newPathParams = calculateLinkPathParams(link);
        link.calculated_params = newPathParams;
        return composeLinkPath(newPathParams);
      });
    // todo: this re-layout technique for whatever reason does not work
    // clearTimeout(this.debounceDragRelayout);
    // this.debounceDragRelayout = setTimeout(() => {
    //   this.sankey.update(this._data);
    //   Object.assign(d, newPosition);
    //   d3.select(this.links.nativeElement)
    //     .selectAll('path')
    //     .transition().duration(RELAYOUT_DURATION)
    //     .attrTween('d', link => {
    //       const newPathParams = calculateLinkPathParams(link);
    //       const paramsInterpolator = d3Interpolate.interpolateObject(link.calculated_params, newPathParams);
    //       return t => {
    //         const interpolatedParams = paramsInterpolator(t);
    //         // save last params on each iterration so we can interpolate from last position upon
    //         // animation interrupt/cancel
    //         link.calculated_params = interpolatedParams;
    //         return composeLinkPath(interpolatedParams);
    //       };
    //     });
    //
    //   d3.select(this.nodes.nativeElement)
    //     .selectAll('g')
    //     .transition().duration(RELAYOUT_DURATION)
    //     .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`);
    // }, 500);
  }

  updateNodeRect = rects => rects
    // .attr('x', ({x0}) => x0)
    // .attr('y', ({y0}) => y0)
    .attr('height', n => {
      return representativePositiveNumber(n.y1 - n.y0);
    })
    .attr('width', ({x1, x0}) => x1 - x0)

  /**
   * Creates the word cloud svg and related elements. Also creates 'text' elements for each value in the 'words' input.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  /**
   * Updates the word cloud svg and related elements. Distinct from createInitialWordCloudElements in that it finds the existing elements
   * and updates them if possible. Any existing words will be re-scaled and moved to their new positions, removed words will be removed,
   * and added words will be drawn.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  private updateDOM(words) {
    const {
      linkClick, nodeClick, nodeMouseOver, pathMouseOver, nodeMouseOut, pathMouseOut, dragmove,
      links: {nativeElement: linksRef}, nodes: {nativeElement: nodesRef},
      updateNodeRect, updateNodeText
    } = this;
    this.d3links = d3.select(linksRef)
      .selectAll('path')
      .data(words.links.sort((a, b) => layerWidth(b) - layerWidth(a)), ({id}) => id)
      .join(
        enter => enter.append('path')
          .on('click', function(data, eventId, links, ...args) {
            return linkClick(this, data, eventId, links, ...args);
          })
          .on('mouseover', function(data, eventId, links, ...args) {
            return pathMouseOver(this, data, eventId, links, ...args);
          })
          .on('mouseout', function(data, eventId, links, ...args) {
            return pathMouseOut(this, data, eventId, links, ...args);
          })
          .call(enterLink => enterLink.append('title'))
          .attr('d', link => {
            link.calculated_params = calculateLinkPathParams(link);
            return composeLinkPath(link.calculated_params);
          }),
        update => update
          .transition().duration(RELAYOUT_DURATION)
          .attrTween('d', link => {
            const newPathParams = calculateLinkPathParams(link);
            const paramsInterpolator = d3Interpolate.interpolateObject(link.calculated_params, newPathParams);
            return t => {
              const interpolatedParams = paramsInterpolator(t);
              // save last params on each iterration so we can interpolate from last position upon
              // animation interrupt/cancel
              link.calculated_params = interpolatedParams;
              return composeLinkPath(interpolatedParams);
            };
          }),
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      // .attr('stroke-width', ({width}) => Math.max(1, width))
      .attr('fill', ({schemaClass}) => schemaClass)
      .call(join =>
        join.select('title')
          .text(({description}) => description)
      );
    const self = this;
    d3.select(nodesRef)
      .selectAll('g')
      .data(words.nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0), ({id}) => id)
      .join(
        enter => enter.append('g')
          .on('mouseover', function(data, eventId, links, ...args) {
            if (self.dragging) {
              return;
            }
            return nodeMouseOver(this, data, eventId, links, ...args);
          })
          .on('mouseout', function(data, eventId, links, ...args) {
            if (self.dragging) {
              return;
            }
            return nodeMouseOut(this, data, eventId, links, ...args);
          })
          .call(
            d3.drag()
              .subject(d => d)
              .on('start', function() {
                self.dragging = true;
                this.parentNode.appendChild(this);
              })
              .on('drag', function(d) {
                return dragmove(this, d);
              })
              // tslint:disable-next-line:only-arrow-functions
              .on('end', function(d) {
                self.dragging = false;
                console.log(d3.event);
                if (d3.event.dx + d3.event.dy < 5) {
                  nodeClick(undefined, d, undefined, undefined);
                }
              })
          )
          .attr('fill', ({color}) => color)
          .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`)
          .call(enterNode =>
            updateNodeRect(
              enterNode.append('rect')
                .on('click', function(data, eventId, links, ...args) {
                  return nodeClick(this, data, eventId, links, ...args);
                })
            )
          )
          .call(enterNode =>
            updateNodeText(
              enterNode.append('text')
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
            )
          )
          .call(enterNode =>
            enterNode.append('title')
          )
          .call(e => this.enter.emit(e)),
        update => update
          .call(enterNode =>
            updateNodeRect(
              enterNode.select('rect')
                .transition().duration(RELAYOUT_DURATION)
            )
          )
          .call(enterNode =>
            updateNodeText(
              enterNode.select('text')
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .transition().duration(RELAYOUT_DURATION)
            )
          )
          .call(enterNode =>
            enterNode.select('title')
          )
          .transition().duration(RELAYOUT_DURATION)
          .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`),
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      .call(enterNode =>
        updateNodeRect(
          enterNode.select('rect')
        )
      )
      .call(joined => joined.select('rect')
        .attr('stroke', '#000000')
      )
      .call(joined => joined.select('text')
        .text(shortNodeText)
      )
      .call(joined => joined.select('title')
        .text(({name}) => name)
      );
  }
}
