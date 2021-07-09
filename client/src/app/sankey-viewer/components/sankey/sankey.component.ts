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
  SimpleChanges,
  OnChanges
} from '@angular/core';

import * as d3 from 'd3';
import * as d3Sankey from 'd3-sankey';
import { createResizeObserver, layerWidth, composeLinkPath, calculateLinkPathParams, shortNodeText, INITIALLY_SHOWN_CHARS } from './utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { colorByTraceEnding } from './algorithms/traceLogic';
import { representativePositiveNumber, nodeLabelAccessor } from '../utils';
import { identifyCircles } from '../algorithms/d3-sankey/d3-sankey-circular';
import { computeNodeLinks, registerLinks } from '../algorithms/d3-sankey/d3-sankey';


@Component({
  selector: 'app-sankey',
  templateUrl: './sankey.component.html',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyComponent implements AfterViewInit, OnDestroy, OnChanges {
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

  // region Properties (&Accessors)
  static MIN_FONT = 12;
  static MAX_FONT = 48;
  static MARGIN = 10;
  margin = {
    top: SankeyComponent.MARGIN,
    right: SankeyComponent.MARGIN,
    bottom: SankeyComponent.MARGIN,
    left: SankeyComponent.MARGIN
  };
  resizeObserver: any;
  size;
  zoom;
  dragging = false;
  private readonly sankey: any;

  // shallow copy of input data
  private _data: SankeyData = {} as SankeyData;

  @ViewChild('wrapper', {static: false}) wrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('nodes', {static: false}) nodes!: ElementRef;
  @ViewChild('links', {static: false}) links!: ElementRef;

  @Output() nodeClicked = new EventEmitter();
  @Output() linkClicked = new EventEmitter();
  @Output() enter = new EventEmitter();
  @Output() adjustLayout = new EventEmitter();

  @Input() normalizeLinks = true;
  @Input() timeInterval;
  @Input() selectedNodes = new Set<object>();
  @Input() selectedLinks = new Set<object>();
  @Input() nodeAlign: 'Left' | 'Right' | 'Justify' | ((a: SankeyNode, b?: number) => number);

  @Input() set data(data) {
    this._data = {...data} as SankeyData;
  }

  get data() {
    return this._data;
  }

  static updateTextShadow(_) {
    // this contains ref to textGroup
    // @ts-ignore
    const [shadow, text] = this.children;
    const {x, y, width, height} = text.getBBox();
    d3.select(shadow)
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height);
  }

  static getFontSize(normSize) {
    return this.MIN_FONT + (normSize || 0) * (SankeyComponent.MAX_FONT - SankeyComponent.MIN_FONT);
  }

  static nodeGroupAccessor({type}) {
    return type;
  }

  // endregion

  // region Life cycle
  ngOnChanges({timeInterval, selectedNodes, selectedLinks, data, nodeAlign}: SimpleChanges) {
    // using on Changes in place of setters as order is important
    if (timeInterval) {
      this.sankey.timeInterval(timeInterval.currentValue);
    }
    if (nodeAlign) {
      const align = nodeAlign.currentValue;
      if (typeof align === 'function') {
        this.sankey.nodeAlign(align);
      } else if (align) {
        this.sankey.nodeAlign(d3Sankey['sankey' + align]);
      }
    }

    if (data && this.svg) {
      // using this.data instead of current value so we use copy made by setter
      this.updateLayout(this.data).then(d => this.updateDOM(d));
    }

    if (selectedNodes) {
      const nodes = selectedNodes.currentValue;
      if (nodes.size) {
        this.selectNodes(nodes);
      } else {
        this.deselectNodes();
      }
      const selectedTraces = this.getSelectedTraces({nodes});
      this.selectTraces(selectedTraces);
    }
    if (selectedLinks) {
      const links = selectedLinks.currentValue;
      if (links.size) {
        this.selectLinks(links);
      } else {
        this.deselectLinks();
      }
      const selectedTraces = this.getSelectedTraces({links});
      this.selectTraces(selectedTraces);
    }
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

  // endregion

  // region D3Selection
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

  // endregion

  // region Graph sizing
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

  nodeMouseOver(element, data) {
    this.highlightNode(element);
    const nodeGroup = SankeyComponent.nodeGroupAccessor(data);
    this.highlightNodeGroup(nodeGroup);
    const traces = new Set([].concat(data.sourceLinks, data.targetLinks).map(link => link._trace));
    this.highlightTraces(traces);
  }

  nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightTraces();
  }

  scaleZoom(scaleBy) {
    d3.select(this.svg.nativeElement).transition().call(this.zoom.scaleBy, scaleBy);
  }

  resetZoom() {
    d3.select(this.svg.nativeElement).call(this.zoom.transform, d3.zoomIdentity);
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

  // endregion

  // region Select
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

  // endregion

  // region Highlight
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

  highlightNodeGroup(group) {
    this.nodeSelection
      .attr('highlighted', node => SankeyComponent.nodeGroupAccessor(node) === group);
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
          //   const label = nodeLabelAccessor(n);
          //   const length = label.length;
          //   const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
          //   return t => t === 1 ? label :
          //     (label.slice(0, interpolator(t)) + '...').slice(0, length);
          // })
          .text(n => nodeLabelAccessor(n));
      });
    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyComponent.updateTextShadow)
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
      //   const label = nodeLabelAccessor(n);
      //   const length = label.length;
      //   const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
      //   return t => (label.slice(0, interpolator(t)) + '...').slice(0, length);
      // });
      .text(shortNodeText);
  }

  // endregion

  /**
   * Draws a word cloud with the given FilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of FilterEntity data
   */
  updateLayout(data) {
    return new Promise(resolve => {
        computeNodeLinks(data);
        // data.links.forEach(link => {
        //   delete link.circular;
        //   delete link.circularLinkID;
        // });
        identifyCircles(data);
        const {nodes, links, ...rest} = data;
        const [circularLinks, nonCircularLinks] = links.reduce(([c, nc], n) => {
          if (n.circular) {
            c.push(n);
          } else {
            nc.push(n);
          }
          return [c, nc];
        }, [[], []]);
        this.sankey({nodes, links: nonCircularLinks});
        // Link into graph prev filtered links
        registerLinks({nodes, links: circularLinks});
        circularLinks.forEach(link => {
          delete link.width;
          delete link.y0;
          delete link.y1;
        });
        const layout = {
          nodes,
          links: nonCircularLinks.concat(circularLinks),
          ...rest
        };
        this.adjustLayout.emit({
          data: layout,
          extent: this.sankey.extent()
        });
        resolve(layout);
      }
    );
  }

  // region Render

  updateNodeRect = rects => rects
    .attr('height', n => representativePositiveNumber(n.y1 - n.y0))
    .attr('width', ({x1, x0}) => x1 - x0)
    .attr('width', ({x1, x0}) => x1 - x0)

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
          .classed('circular', ({circular}) => circular)
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
              .text(({label}) => label)
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

  // endregion
}
