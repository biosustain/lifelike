import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, EventEmitter, Output, ViewEncapsulation } from '@angular/core';

import * as d3 from 'd3';
import * as d3Sankey from 'd3-sankey';
import {
  createResizeObserver,
  layerWidth,
  composeLinkPath,
  calculateLinkPathParams,
  shortNodeText,
  nodeLabelAccessor,
  INITIALLY_SHOWN_CHARS
} from './utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { colorByTraceEnding } from './algorithms/traceLogic';
import { representativePositiveNumber } from '../utils';

function updateTextShadow(_) {
  // this contains ref to textGroup
  const [shadow, text] = this.children;
  const {x, y, width, height} = text.getBBox();
  d3.select(shadow)
    .attr('x', x)
    .attr('y', y)
    .attr('width', width)
    .attr('height', height);
}

@Component({
  selector: 'app-sankey',
  templateUrl: './sankey.component.html',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyComponent implements AfterViewInit, OnDestroy {

  @Input() set timeInterval(ti) {
    if (this.sankey) {
      this.sankey.timeInterval(ti);
    }
  }

  get updateNodeText() {
    // noinspection JSUnusedLocalSymbols
    const [width, _height] = this.sankey.size();
    return texts => texts
      .attr('transform', ({x0, x1, y0, y1}) => `translate(${x0 < width / 2 ? (x1 - x0) + 6 : -6} ${(y1 - y0) / 2})`)
      .attr('text-anchor', 'end')
      .call(textGroup =>
        textGroup.select('text')
          .attr('dy', '0.35em')
      )
      .filter(({x0}) => x0 < width / 2)
      .attr('text-anchor', 'start');
  }

  get selectedNodes() {
    return this._selectedNodes;
  }

  @Input() set selectedNodes(nodes) {
    if (nodes.size) {
      this.selectNodes(nodes);
    } else {
      this.deselectNodes();
    }
    this._selectedNodes = nodes;
    const selectedTraces = this.getSelectedTraces({nodes});
    this.selectTraces(selectedTraces);
  }

  get selectedLinks() {
    return this._selectedLinks;
  }

  @Input() set selectedLinks(links) {
    if (links.size) {
      this.selectLinks(links);
    } else {
      this.deselectLinks();
    }
    this._selectedLinks = links;
    const selectedTraces = this.getSelectedTraces({links});
    this.selectTraces(selectedTraces);
  }

  get data() {
    return this._data;
  }

  @Input('data') set data(data) {
    this._data = {...data} as SankeyData;
    if (this.svg) {
      this.updateLayout(this._data).then(d => this.updateDOM(d));
    }
  }

  constructor(
    private elRef: ElementRef,
    private clipboard: ClipboardService,
    private readonly snackBar: MatSnackBar
  ) {
    this.sankey = d3Sankey.sankey()
      .nodeId(n => n.id)
      .nodePadding(10)
      // .nodePaddingRatio(0.1)
      .linkSort((a, b) =>
        (b.source.index - a.source.index) ||
        (b.target.index - a.target.index) ||
        (b._trace.group - a._trace.group)
      )
      // .nodeSort((a, b) =>
      //   (b.depth - a.depth) ||
      //   (b.index - a.index)
      // )
      .nodeAlign(d3Sankey.sankeyRight)
      .nodeWidth(10);

    this.linkClick = this.linkClick.bind(this);
    this.nodeClick = this.nodeClick.bind(this);
    this.nodeMouseOver = this.nodeMouseOver.bind(this);
    this.pathMouseOver = this.pathMouseOver.bind(this);
    this.nodeMouseOut = this.nodeMouseOut.bind(this);
    this.pathMouseOut = this.pathMouseOut.bind(this);
    this.dragmove = this.dragmove.bind(this);
    this.attachLinkEvents = this.attachLinkEvents.bind(this);
    this.attachNodeEvents = this.attachNodeEvents.bind(this);

    this.zoom = d3.zoom()
      .scaleExtent([0.1, 8]);
  }

  get linkSelection() {
    // returns empty selection if DOM struct was not initialised
    return d3.select(this.links && this.links.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }

  get nodeSelection() {
    // returns empty selection if DOM struct was not initialised
    return d3.select(this.nodes && this.nodes.nativeElement)
      .selectAll(function() {
        // by default there is recursive match, not desired in here
        return this.children;
      });
  }
  @Input() normalizeLinks = true;
  @ViewChild('wrapper', {static: false}) wrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('nodes', {static: false}) nodes!: ElementRef;
  @ViewChild('links', {static: false}) links!: ElementRef;
  @Output() nodeClicked = new EventEmitter();
  @Output() linkClicked = new EventEmitter();
  @Output() enter = new EventEmitter();
  MARGIN = 10;
  margin = {
    top: this.MARGIN,
    right: this.MARGIN,
    bottom: this.MARGIN,
    left: this.MARGIN
  };
  MIN_FONT = 12;
  MAX_FONT = 48;
  resizeObserver: any;
  size;
  zoom;
  dragging = false;
  @Output() adjustLayout = new EventEmitter();
  private readonly sankey: any;

  _selectedNodes = new Set<object>();

  _selectedLinks = new Set<object>();

  private _data: SankeyData = {} as SankeyData;

  deselectNodes() {
    this.nodeSelection
      .attr('selected', undefined);
  }

  deselectLinks() {
    this.linkSelection
      .attr('selected', undefined);
  }

  getSelectedTraces(selection) {
    const {links = this.selectedLinks, nodes = this.selectedNodes} = selection;
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {sourceLinks, targetLinks}) =>
        linksAccumulator.concat(sourceLinks, targetLinks)
      , []
    );
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
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

  resetZoom() {
    d3.select(this.svg.nativeElement).call(this.zoom.transform, d3.zoomIdentity);
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
        this.adjustLayout.emit({data, extent: this.sankey.extent()});
        resolve(a);
      }
    );
  }

  linkClick(element, data) {
    this.linkClicked.emit(data);
    this.clipboard.writeToClipboard(data.path).then(_ =>
        this.snackBar.open(
          `Path copied to clipboard`,
          undefined,
          {duration: 500},
        ),
      console.error
    );

    // this.showPopOverForSVGElement(element, {link: data});
  }

  nodeClick(element, data) {
    this.nodeClicked.emit(data);
  }

  pathMouseOver(element, data) {
    this.highlightTraces(new Set([data._trace]));
  }

  pathMouseOut(element, _data) {
    this.unhighlightTraces();
  }

  selectTraces(traces: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selectedTrace', ({_trace}) => traces.has(_trace))
      .filter(({_trace}) => traces.has(_trace))
      .raise();
  }

  selectNodes(nodes: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('selected', n => nodes.has(n));
  }

  selectLinks(links: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selected', l => links.has(l));
  }

  highlightTraces(traces: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('highlighted', ({_trace, _selected}) => traces.has(_trace))
      .filter(({_trace, _selected}) => traces.has(_trace))
      .raise();
  }

  unhighlightTraces() {
    this.linkSelection
      .attr('highlighted', undefined);
  }

  nodeGroupAccessor({type}) {
    return type;
  }

  nodeMouseOver(element, data) {
    this.highlightNode(element);
    const nodeGroup = this.nodeGroupAccessor(data);
    this.highlightNodeGroup(nodeGroup);
    const traces = new Set([].concat(data.sourceLinks, data.targetLinks).map(link => link._trace));
    this.highlightTraces(traces);
  }

  highlightNodeGroup(group) {
    this.nodeSelection
      .attr('highlighted', node => this.nodeGroupAccessor(node) === group);
  }

  highlightNode(element) {
    const selection = d3.select(element)
      .raise()
      .attr('highlighted', true)
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(shortNodeText)
          .filter(n => INITIALLY_SHOWN_CHARS < nodeLabelAccessor(n).length)
          // todo: reenable when performance improves
          // .transition().duration(RELAYOUT_DURATION)
          // .textTween(n => {
          //   const displayName = nodeLabelAccessor(n);
          //   const length = displayName.length;
          //   const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
          //   return t => t === 1 ? displayName :
          //     (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
          // })
          .text(n => nodeLabelAccessor(n));
      });
    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(updateTextShadow)
    );
  }

  unhighlightNode(element) {
    this.nodeSelection
      .attr('highlighted', false);

    d3.select(element).select('text')
      .filter(n => INITIALLY_SHOWN_CHARS < nodeLabelAccessor(n).length)
      // todo: reenable when performance improves
      // .transition().duration(RELAYOUT_DURATION)
      // .textTween(n => {
      //   const displayName = nodeLabelAccessor(n);
      //   const length = displayName.length;
      //   const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
      //   return t => (displayName.slice(0, interpolator(t)) + '...').slice(0, length);
      // });
      .text(shortNodeText);
  }

  nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightTraces();
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
    d3.select(element)
      .raise()
      .attr('transform', `translate(${d.x0},${d.y0})`);
    const relatedLinksIds = d.sourceLinks.concat(d.targetLinks).map(({id}) => id);
    this.linkSelection
      .filter(({id}) => relatedLinksIds.includes(id))
      .attr('d', link => {
        const newPathParams = calculateLinkPathParams(link, this.normalizeLinks);
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
    .attr('height', n => representativePositiveNumber(n.y1 - n.y0))
    .attr('width', ({x1, x0}) => x1 - x0)
    .attr('width', ({x1, x0}) => x1 - x0)

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
    let dragging = false;
    d3Nodes
      .on('mouseover', function(data) {
        return dragging || nodeMouseOver(this, data);
      })
      .on('mouseout', function(data) {
        return dragging || nodeMouseOut(this, data);
      })
      .call(
        d3.drag()
          .clickDistance(1000)
          .on('start', function() {
            this.parentNode.appendChild(this);
          })
          .on('drag', function(d) {
            dragging = true;
            dragmove(this, d);
          })
          // tslint:disable-next-line:only-arrow-functions
          .on('end', function(d) {
            // tslint:disable-next-line:no-unused-expression
            dragging || nodeClick(this, d);
            dragging = false;
          })
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
      updateNodeRect, updateNodeText
    } = this;

    this.linkSelection
      .data(words.links.sort((a, b) => layerWidth(b) - layerWidth(a)), ({id}) => id)
      .join(
        enter => enter
          .append('path')
          .call(this.attachLinkEvents)
          .attr('d', link => {
            link.calculated_params = calculateLinkPathParams(link, this.normalizeLinks);
            return composeLinkPath(link.calculated_params);
          })
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
          //     // save last params on each iterration so we can interpolate from last position upon
          //     // animation interrupt/cancel
          //     link.calculated_params = interpolatedParams;
          //     return composeLinkPath(interpolatedParams);
          //   };
          // })
          .attr('d', link => {
            link.calculated_params = calculateLinkPathParams(link, this.normalizeLinks);
            return composeLinkPath(link.calculated_params);
          }),
        exit => exit.remove()
      )
      .attr('fill', ({_color}) => _color)
      .call(join =>
        join.select('title')
          .text(({description}) => description)
      );

    this.nodeSelection
      .data(
        words.nodes.filter(
          // should no longer be an issue but leaving as sanity check
          // (if not satisfied visualisation brakes)
          n => n.sourceLinks.length + n.targetLinks.length > 0
        ),
        ({id}) => id
      )
      .join(
        enter => enter.append('g')
          .call(enterNode =>
            updateNodeRect(
              enterNode.append('rect')
            )
          )
          .call(this.attachNodeEvents)
          .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`)
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
              .text(({name = []}) => Array.isArray(name) ? name.join('\n') : name)
          )
          .call(e => this.enter.emit(e)),
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
          .attr('transform', ({x0, y0}) => `translate(${x0},${y0})`),
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      .call(joined => {
        updateNodeRect(
          joined
            .select('rect')
            .attr('fill', (node: SankeyNode) => {
              const traceColor = colorByTraceEnding(node);
              return traceColor || node._color;
            })
        );
        joined.select('g')
          .call(textGroup => {
            textGroup.select('text')
              .text(shortNodeText);
          });
      });
  }
}
