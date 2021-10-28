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
import { MatSnackBar } from '@angular/material/snack-bar';

import * as d3 from 'd3';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { SankeyData, SankeyNode } from 'app/shared-sankey/interfaces';

import { representativePositiveNumber } from '../utils';
import * as aligns from './aligin';
import { SankeyLayoutService } from './sankey-layout.service';
import { createResizeObserver } from './utils';


@Component({
  selector: 'app-sankey',
  templateUrl: './sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyComponent implements AfterViewInit, OnDestroy, OnChanges {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SankeyLayoutService,
    readonly wrapper: ElementRef
  ) {
    Object.assign(sankey, {
      py: 10, // nodePadding
      dx: 10, // nodeWidth
    });

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

  // shallow copy of input data
  private _data: SankeyData = {} as SankeyData;

  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('nodes', {static: false}) nodes!: ElementRef;
  @ViewChild('links', {static: false}) links!: ElementRef;

  @Output() nodeClicked = new EventEmitter();
  @Output() linkClicked = new EventEmitter();
  @Output() backgroundClicked = new EventEmitter();
  @Output() enter = new EventEmitter();
  @Output() adjustLayout = new EventEmitter();

  @Input() normalizeLinks = true;
  @Input() selectedNodes = new Set<object>();
  @Input() searchedEntities = new Set<object>();
  @Input() focusedNode;
  @Input() selectedLinks = new Set<object>();
  @Input() nodeAlign: 'left' | 'right' | 'justify' | ((a: SankeyNode, b?: number) => number);

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

  static nodeGroupAccessor({type}) {
    return type;
  }

  // endregion

  // region Life cycle
  ngOnChanges({selectedNodes, selectedLinks, searchedEntities, focusedNode, data, nodeAlign}: SimpleChanges) {
    // using on Changes in place of setters as order is important
    if (nodeAlign) {
      const align = nodeAlign.currentValue;
      if (typeof align === 'function') {
        this.sankey.align = align;
      } else if (align) {
        this.sankey.align = aligns[align];
      }
    }

    if (data && this.svg) {
      // using this.data instead of current value so we use copy made by setter
      this.updateLayout(this.data).then(d => this.updateDOM(d));
    }

    const nodes = this.selectedNodes;
    const links = this.selectedLinks;

    if (selectedNodes) {
      if (nodes.size) {
        this.selectNodes(nodes);
      } else {
        this.deselectNodes();
      }
    }

    if (selectedLinks) {
      if (links.size) {
        this.selectLinks(links);
      } else {
        this.deselectLinks();
      }
    }

    if (selectedLinks || selectedNodes) {
      this.calculateAndApplyTransitiveConnections(nodes, links);
    }

    if (searchedEntities) {
      const entities = searchedEntities.currentValue;
      if (entities.size) {
        this.searchNodes(entities);
        this.searchLinks(entities);
      } else {
        this.stopSearchNodes();
        this.stopSearchLinks();
      }
    }
    if (focusedNode) {
      const {currentValue, previousValue} = focusedNode;
      if (previousValue) {
        this.unFocusNode(previousValue);
        this.unFocusLink(previousValue);
      }
      if (currentValue) {
        this.focusNode(currentValue);
        this.focusLink(currentValue);
      }
    }
  }

  ngAfterViewInit() {
    // attach zoom behaviour
    const {g, zoom} = this;
    const zoomContainer = d3.select(g.nativeElement);
    zoom.on('zoom', _ => zoomContainer.attr('transform', d3.event.transform));

    this.sankeySelection.on('click', () => {
      const e = d3.event;
      if (!e.target.__data__) {
        this.backgroundClicked.emit();
      }
    });

    // resize and listen to future resize events
    this.resizeObserver = createResizeObserver(this.onResize.bind(this), this.wrapper.nativeElement);
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

  get sankeySelection() {
    return d3.select(this.svg && this.svg.nativeElement);
  }

  // endregion

  // region Graph sizing
  onResize(width, height) {
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

    this.sankey.extent = [[margin.left, margin.top], [extentX, extentY]];

    return this.updateLayout(this.data).then(this.updateDOM.bind(this));
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
        d3.drag()
          .on('start', function() {
            dx = 0;
            dy = 0;
            d3.select(this).raise();
          })
          .on('drag', function(d) {
            dx += d3.event.dx;
            dy += d3.event.dy;
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

  async linkClick(element, data) {
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

  async nodeClick(element, data) {
    this.nodeClicked.emit(data);
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered path.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  async pathMouseOver(element, data) {
    d3.select(element)
      .raise();

    // temporary disabled as of LL-3726
    // const nodeGroup = new Set<number>(data._trace.node_paths.reduce((acc: number[], curr: number[]) => acc.concat(curr), []));
    // const traces = new Set<any>([data._trace]);
    //
    // this.highlightNodeGroup(nodeGroup);
    // this.highlightTraces(traces);
  }

  /**
   * Callback that undims all nodes/links.
   * @param element the svg element being hovered over
   * @param data object representing the link data
   */
  async pathMouseOut(element, data) {
    // temporary disabled as of LL-3726
    // this.unhighlightNodes();
    // this.unhighlightLinks();
  }

  /**
   * Callback that dims any nodes/links not connected through the hovered node.
   * styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  async nodeMouseOver(element, data) {
    this.applyNodeHover(element);

    // temporary disabled as of LL-3726
    // const traces = new Set<any>([].concat(data._sourceLinks, data._targetLinks).map(link => link._trace));
    // const nodeGroup = this.calculateNodeGroupFromTraces(traces);
    // this.highlightNodeGroup(nodeGroup);
    // this.highlightTraces(traces);
  }

  /**
   * Callback that undims all nodes/links. Also unsets hover styling on the hovered node.
   * @param element the svg element being hovered over
   * @param data object representing the node data
   */
  async nodeMouseOut(element, data) {
    this.unapplyNodeHover(element);

    // temporary disabled as of LL-3726
    // this.unhighlightNodes();
    // this.unhighlightLinks();
  }

  scaleZoom(scaleBy) {
    // @ts-ignore
    this.sankeySelection.transition().call(this.zoom.scaleBy, scaleBy);
  }

  // noinspection JSUnusedGlobalSymbols
  resetZoom() {
    // it is used by its parent
    this.sankeySelection.call(this.zoom.transform, d3.zoomIdentity);
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
      _x0: d._x0 + d3.event.dx,
      _x1: d._x0 + d3.event.dx + nodeWidth,
      _y0: d._y0 + d3.event.dy,
      _y1: d._y0 + d3.event.dy + nodeHeight
    };
    Object.assign(d, newPosition);
    d3.select(element)
      .raise()
      .attr('transform', `translate(${d._x0},${d._y0})`);
    const relatedLinksIds = d._sourceLinks.concat(d._targetLinks).map(id);
    this.linkSelection
      .filter(link => relatedLinksIds.includes(id(link)))
      .attr('d', linkPath);
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
    //       const paramsInterpolator = d3Interpolate.interpolateObject(link._calculated_params, newPathParams);
    //       return t => {
    //         const interpolatedParams = paramsInterpolator(t);
    //         // save last params on each iterration so we can interpolate from last position upon
    //         // animation interrupt/cancel
    //         link._calculated_params = interpolatedParams;
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

  // Assign attr based on accessor and raise trueish results
  assignAttrAndRaise(selection, attr, accessor) {
    return selection
      // This technique fails badly
      // there is race condition between attr set and moving the node by raise call
      // .each(function(s) {
      //   // use each so we search traces only once
      //   const selected = accessor(s);
      //   const element = d3.select(this)
      //     .attr(attr, selected);
      //   if (selected) {
      //     element.raise();
      //   }
      // })
      .attr(attr, accessor)
      .filter(accessor)
      .call(e => e.raise());
  }

  // region Select
  /**
   * Adds the `selected` property to the given input nodes.
   * @param nodes set of node data objects to use for selection
   */
  selectNodes(nodes: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('selected', n => nodes.has(n));
  }

  /**
   * Adds the `selected` property to the given input links.
   * @param links set of link data objects to use for selection
   */
  selectLinks(links: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selected', l => links.has(l));
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

  /**
   * Given the set of selected nodes and links, calculcates the connected nodes/links and applies the `transitively-selected` attribute to
   * them.
   * @param nodes the full set of currently selected nodes
   * @param links the full set of currently selected links
   */
  calculateAndApplyTransitiveConnections(nodes: Set<object>, links: Set<object>) {
    if (nodes.size + links.size === 0) {
      this.nodeSelection
        .attr('transitively-selected', undefined);
      this.linkSelection
        .attr('transitively-selected', undefined);
      return;
    }

    const traces = new Set<any>();
    links.forEach((link: any) => traces.add(link._trace));
    nodes.forEach((data: any) => [].concat(data._sourceLinks, data._targetLinks).forEach(link => traces.add(link._trace)));
    const nodeGroup = this.calculateNodeGroupFromTraces(traces);


    this.nodeSelection
      .attr('transitively-selected', ({id}) => nodeGroup.has(id));
    this.linkSelection
      .attr('transitively-selected', ({_trace}) => traces.has(_trace));
  }

  // endregion

  // region Search
  searchNodes(nodes: Set<object>) {
    const selection = this.nodeSelection
      .attr('searched', n => nodes.has(n))
      .filter(n => nodes.has(n))
      .raise()
      .select('g');

    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyComponent.updateTextShadow)
    );
  }

  stopSearchNodes() {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('searched', undefined);
  }

  searchLinks(links: Set<object>) {
    this.linkSelection
      .attr('searched', l => links.has(l))
      .filter(l => links.has(l))
      .raise();
  }

  stopSearchLinks() {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('searched', undefined);
  }

  // endregion

  // region Focus
  focusNode(node: object) {
    const {nodeLabel} = this.sankey;
    // tslint:disable-next-line:no-unused-expression
    const selection = this.nodeSelection
      .filter(n => node === n)
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
        .each(SankeyComponent.updateTextShadow)
    );
  }

  unFocusNode(node: object) {
    const {nodeLabelShort} = this.sankey;
    // tslint:disable-next-line:no-unused-expression
    const selection = this.nodeSelection
      .attr('focused', undefined)
      .filter(n => node === n)
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(nodeLabelShort);
      });

    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyComponent.updateTextShadow)
    );
  }

  focusLink(link: object) {
    this.linkSelection
      .filter(l => link === l)
      .raise()
      .attr('focused', true);
  }

  // noinspection JSUnusedLocalSymbols
  unFocusLink(link: object) {
    this.linkSelection
      .attr('focused', undefined);
  }

  // endregion

  // region Highlight
  highlightTraces(traces: Set<object>) {
    this.assignAttrAndRaise(this.linkSelection, 'highlighted', ({_trace}) => traces.has(_trace));
  }

  unhighlightLinks() {
    this.linkSelection
      .attr('highlighted', undefined);
  }

  highlightNodeGroup(group) {
    this.nodeSelection
      .attr('highlighted', ({id}) => group.has(id));
  }

  unhighlightNodes() {
    this.nodeSelection
      .attr('highlighted', undefined);
  }

  // endregion

  applyNodeHover(element) {
    const {
      nodeLabelShort, nodeLabelShouldBeShorted, nodeLabel
    } = this.sankey;
    const selection = d3.select(element)
      .raise()
      .select('g')
      .call(textGroup => {
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
      });
    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyComponent.updateTextShadow)
    );
  }

  unapplyNodeHover(element) {
    const {sankey: {nodeLabelShort, nodeLabelShouldBeShorted}, searchedEntities} = this;

    const selection = d3.select(element);
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

    // resize shadow back to shorter test when it is used as search result
    if (searchedEntities.size) {
      // postpone so the size is known
      requestAnimationFrame(_ =>
        selection.select('g')
          .each(SankeyComponent.updateTextShadow)
      );
    }
  }

  // endregion

  /**
   * Calculates layout including pre-adjustments, d3-sankey calc, post adjustments
   * and adjustments from outer scope
   * @param data graph declaration
   */
  updateLayout(data) {
    return new Promise(resolve => {
        if (!data._precomputedLayout) {
          this.sankey.calcLayout(data);
        }
        resolve(data);
      }
    );
  }

  // region Render

  updateNodeRect = rects => rects
    .attr('height', ({_y1, _y0}) => representativePositiveNumber(_y1 - _y0))
    .attr('width', ({_x1, _x0}) => _x1 - _x0)
    .attr('width', ({_x1, _x0}) => _x1 - _x0)

  get updateNodeText() {
    // noinspection JSUnusedLocalSymbols
    const [width, _height] = this.sankey.size;
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
        linkPath,
        circular
      }
    } = this;

    const layerWidth = ({_source, _target}) => Math.abs(_target._layer - _source._layer);

    this.linkSelection
      .data(graph.links.sort((a, b) => layerWidth(b) - layerWidth(a)), id)
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
      .style('fill', linkColor)
      .attr('thickness', d => d._width || 0)
      .call(join =>
        join.select('title')
          .text(linkTitle)
      );

    this.nodeSelection
      .data(
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
          .attr('transform', ({_x0, _y0}) => `translate(${_x0},${_y0})`),
        exit => exit.remove()
      )
      .call(joined => {
        updateNodeRect(
          joined
            .select('rect')
            .style('fill', nodeColor)
        );
        joined.select('g')
          .call(textGroup => {
            textGroup.select('text')
              .text(nodeLabelShort);
          });
      });
  }

  // endregion

  // region Helpers

  /**
   * Given a set of traces, returns a set of all nodes within those traces.
   * @param traces a set of trace objects
   * @returns a set of node ids representing all nodes in the given traces
   */
  calculateNodeGroupFromTraces(traces: Set<any>) {
    const nodeGroup = new Set<number>();
    traces.forEach(
      trace => trace.node_paths.forEach(
        path => path.forEach(
          nodeId => nodeGroup.add(nodeId)
        )
      )
    );
    return nodeGroup;
  }

  // endregion
}
