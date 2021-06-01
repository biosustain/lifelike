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
import { createMapToColor, clamp, SankeyGraph, createResizeObserver, layerWidth, composeLinkPath, calculateLinkPathParams } from './utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

const RELAYOUT_DURATION = 250;
const INITIALLY_SHOWN_CHARS = 10;

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

  @ViewChild('popover', {static: false}) public popover: NgbPopover;
  @ViewChild('popoverAnchor', {static: false}) public popoverAnchor;

  viewTransformation;

  constructor(
    private elRef: ElementRef,
    private clipboard: ClipboardService,
    private readonly snackBar: MatSnackBar,
    private readonly domSanitizer: DomSanitizer
  ) {
    this.sankey = d3Sankey.sankey()
      .nodeId(n => n.id)
      .nodeAlign(d3Sankey.sankeyRight)
      .nodeWidth(10);
    this.uiState = new BehaviorSubject({panX: 0, panY: 0, zoom: 1});
  }

  @Input('data') set data({links, graph, nodes, ...data}) {
    const pathIdAccessor = path => nodes.find(n => n.id === path[0]).name[0];
    const linksColorMap = createMapToColor(graph.up2aak1.map(pathIdAccessor));
    graph.up2aak1.forEach(path => {
      const color = linksColorMap.get(pathIdAccessor(path));
      path.forEach((nodeId, nodeIdx, p) => {
        const nextNodeId = p[nodeIdx + 1] || NaN;
        const link = links.find(({source, target, schemaClass}) => source === nodeId && target === nextNodeId && !schemaClass);
        if (link) {
          link.schemaClass = color;
        } else if (nextNodeId) {
          // console.warn(`Link from ${nodeId} to ${nextNodeId} does not exist.`);
        }
      });
    });
    const nodeColorCategoryAccessor = ({schemaClass}) => schemaClass;
    const nodesColorMap = createMapToColor(
      nodes.map(nodeColorCategoryAccessor),
      {
        hue: () => 0,
        lightness: (i, n) => (i + 0.5) / n,
        saturation: () => 0
      }
    );
    nodes.forEach(node => {
      node.color = nodesColorMap.get(nodeColorCategoryAccessor(node));
    });
    this._data = {...data, nodes, links: links.map(link => ({value: link.pageUp, ...link}))} as SankeyGraph;
    if (this.svg) {
      this.updateLayout(this._data).then(this.updateDOM.bind(this));
    }
  }

  get data() {
    return this._data;
  }

  @ViewChild('wrapper', {static: false}) wrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
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
    this.onResize(width, height).then(_ => {
      this.resizeObserver = createResizeObserver(this.onResize.bind(this), this.wrapper.nativeElement);
      this.wrapper.nativeElement.addEventListener('wheel', event => {
        const {wheelDelta, ctrlKey, shiftKey, deltaX, deltaY, offsetX, offsetY} = event;
        event.preventDefault();
        if (ctrlKey) {
          // zoom with origin on mouse
          const zoomDelta = wheelDelta / 800;
          this.uiState.next(
            this.calculateNextUIState({
              deltaX: offsetX * zoomDelta,
              deltaY: offsetY * zoomDelta,
              zoomDelta
            })
          );
        } else if (shiftKey) {
          // shift + wheel to scroll just horizontally
          this.uiState.next(
            this.calculateNextUIState({
              deltaX: deltaY
            })
          );
        } else {
          // bidirectional scroll
          this.uiState.next(
            this.calculateNextUIState({
              deltaX,
              deltaY
            })
          );
        }
      });
    });

    // todo: figure out panning
    // const hammer = new Hammer(this.wrapper.nativeElement);
    //
    // hammer.on('pan', ({deltaX, deltaY, ...rest}) => {
    //   const {uiState: {value: {zoom}}} = this;
    //   console.log(rest)
    //   this.uiState.next(
    //     this.calculateNextUIState({
    //       deltaX: -deltaX / zoom / zoom,
    //       deltaY: -deltaY / zoom / zoom,
    //       zoomDelta: 0
    //     })
    //   );
    // });
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
    this.uiState.unsubscribe();
    delete this.resizeObserver;
  }

  onResize(width, height) {
    // Get the svg element and update
    d3.select(this.svg.nativeElement)
      .attr('width', width)
      .attr('height', height);

    this.sankey.size([width, height]);

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
        resolve(
          this.sankey(data)
        );
      }
    )
      ;
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
    this.selected = data;
    this.clipboard.writeToClipboard(data.path).then(_ =>
      this.snackBar.open(
        `Path copied to clipboard`,
        undefined,
        {duration: 500},
      )
    );

    this.showPopOverForSVGElement(element, {link: data});
  }

  nodeClick(element, data, _eventId, _links, ..._rest) {
    this.showPopOverForSVGElement(element, {node: data});
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
      .style('opacity', 1);
  }

  nodeMouseOver(element, data, _eventId, _links, ..._rest) {
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .style('opacity', ({color}) => color === data.color ? 1 : 0.35);
    d3.select(element).select('text')
      .text(({displayName}) => displayName.slice(0, INITIALLY_SHOWN_CHARS));
    // .filter(({displayName}) => INITIALLY_SHOWN_CHARS < displayName.length)
    // .transition().duration(RELAYOUT_DURATION)
    // .textTween(({displayName}) => {
    //   const length = displayName.length;
    //   const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
    //   return t => t === 1 ? displayName :
    //     (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
    // });
  }

  nodeMouseOut(element, _data, _eventId, _links, ..._rest) {
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .style('opacity', 1);
    d3.select(element).select('text')
      .text(({displayName}) => displayName.slice(0, INITIALLY_SHOWN_CHARS));
    // .filter(({displayName}) => INITIALLY_SHOWN_CHARS < displayName.length)
    // .transition().duration(RELAYOUT_DURATION)
    // .textTween(({displayName}) => {
    //   const length = displayName.length;
    //   const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
    //   return t => (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
    // });
  }

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
    const [width, _height] = this.sankey.size();
    const linkClick = this.linkClick.bind(this);
    const nodeClick = this.nodeClick.bind(this);
    const nodeMouseOver = this.nodeMouseOver.bind(this);
    const pathMouseOver = this.pathMouseOver.bind(this);
    const nodeMouseOut = this.nodeMouseOut.bind(this);
    const pathMouseOut = this.pathMouseOut.bind(this);
    d3.select(this.links.nativeElement)
      .selectAll('path')
      .data(words.links.sort((a, b) => layerWidth(b) - layerWidth(a)))
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
          })
      )
      // .attr('stroke-width', ({width}) => Math.max(1, width))
      .attr('fill', ({schemaClass}) => schemaClass)
      .call(join =>
        join.selectAll('title')
          .text(({path}) => path)
      );
    const updateNodeRect = rects => rects
      .attr('x', ({x0}) => x0)
      .attr('y', ({y0}) => y0)
      .attr('height', ({y0, y1}) => y1 - y0)
      .attr('width', ({x1, x0}) => x1 - x0);
    const updateNodeText = texts => texts
      .attr('x', ({x0}) => x0 - 6)
      .attr('y', ({y0, y1}) => (y1 + y0) / 2)
      .filter(({x0}) => x0 < width / 2)
      .attr('x', ({x1}) => x1 + 6)
      .attr('text-anchor', 'start');
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .data(words.nodes)
      .join(
        enter => enter.append('g')
          .on('mouseover', function(data, eventId, links, ...args) {
            return nodeMouseOver(this, data, eventId, links, ...args);
          })
          .on('mouseout', function(data, eventId, links, ...args) {
            return nodeMouseOut(this, data, eventId, links, ...args);
          })
          .attr('fill', ({color}) => color)
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
              enterNode.selectAll('rect')
                .transition().duration(RELAYOUT_DURATION)
            )
          )
          .call(enterNode =>
            updateNodeText(
              enterNode.selectAll('text')
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .transition().duration(RELAYOUT_DURATION)
            )
          )
          .call(enterNode =>
            enterNode.selectAll('title')
          ),
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      .call(joined => joined.selectAll('rect')
        .attr('stroke', '#000')
      )
      .call(joined => joined.selectAll('text')
        .text(({displayName}) => displayName.slice(0, 10) + '...')
      )
      .call(joined => joined.selectAll('title')
        .text(({name}) => name)
      );
  }
}
