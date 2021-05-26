import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, ViewEncapsulation, EventEmitter, Output } from '@angular/core';

import * as d3 from 'd3';
import * as d3Sankey from 'd3-sankey';

/**
 * Throttles calling `fn` once per animation frame
 * Latest arguments are used on the actual call
 * @param fn - function which calls should be throttled
 */
export function throttled(fn: (...r: any[]) => void) {
  let ticking = false;
  let args = [];
  return (...rest) => {
    args = Array.prototype.slice.call(rest);
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        fn.apply(window, args);
      });
    }
  };
}

const layerWidth = ({source, target}) => Math.abs(target.layer - source.layer);

const normalizeGenerator = values => {
  const min = Math.min(...values);
  const max = values.reduce((o, n) => o + n, 0);
  return {
    min, max,
    normalize: (max - min) ? d => Math.max(0, d / max) : d => d / max
  };
};

const createResizeObserver = (callback, container) => {
  const resize = throttled(async (width, height) => {
    const w = container.clientWidth;
    await callback(width, height - 42);
    if (w < container.clientWidth) {
      // If the container size shrank during chart resize, let's assume
      // scrollbar appeared. So we resize again with the scrollbar visible -
      // effectively making chart smaller and the scrollbar hidden again.
      // Because we are inside `throttled`, and currently `ticking`, scroll
      // events are ignored during this whole 2 resize process.
      // If we assumed wrong and something else happened, we are resizing
      // twice in a frame (potential performance issue)
      await callback(container.offsetWidth, container.offsetHeight - 42);
    }
  });

  // @ts-ignore until https://github.com/microsoft/TypeScript/issues/37861 implemented
  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    const width = entry.contentRect.width;
    const height = entry.contentRect.height;
    // When its container's display is set to 'none' the callback will be called with a
    // size of (0, 0), which will cause the chart to lost its original height, so skip
    // resizing in such case.
    if (width === 0 && height === 0) {
      return;
    }
    resize(width, height);
  });
  // todo
  observer.observe(container);
  return observer;
};

interface SankeyGraph {
  links: any[];
  nodes: any[];
  graph: any;
}

const colorPalletGenerator = (
  size,
  {
    hue = (i, n) => 360 * (i % 2 ? i : n - 2) / n,
    saturation = (_i, _n) => 0.75,
    lightness = (_i, _n) => 0.75,
    alpha = (_i, _n) => 0.75
  } = {}
) =>
  i => `hsla(${360 * hue(i, size)},${100 * saturation(i, size)}%,${100 * lightness(i, size)}%,${alpha(i, size)})`;

const createMapToColor = (arr, ...rest) => {
  const uniq = new Set(arr);
  const palette = colorPalletGenerator(uniq.size, ...rest);
  return new Map([...uniq].map((v, i) => [v, palette(i)]));
};

@Component({
  selector: 'app-sankey',
  templateUrl: './sankey.component.html',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cloudWrapper', {static: false}) cloudWrapper!: ElementRef;
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
  @Input() set timeInterval(ti) {
    if (this.sankey) {
      this._timeInterval = ti;
      this.sankey.timeInterval(ti);
    }
  }

  get timeInterval() {
    return this._timeInterval;
  }

  constructor() {
    this.sankey = d3Sankey.sankey()
      .nodeId(n => n.id)
      .nodeAlign(d3Sankey.sankeyRight)
      .nodeWidth(10);
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

  ngAfterViewInit() {
    const {width, height} = this.getCloudSvgDimensions();
    this.onResize(width, height).then();
    this.resizeObserver = createResizeObserver(this.onResize.bind(this), this.cloudWrapper.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();

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
    const cloudWrapper = this.cloudWrapper.nativeElement;
    const {
      margin
    } = this;
    return {
      width: cloudWrapper.offsetWidth - margin.left - margin.right,
      height: cloudWrapper.offsetHeight - margin.top - margin.bottom
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
    const [width, _height] = this.sankey.size();
    d3.select(this.links.nativeElement)
      .selectAll('path')
      .data(words.links.sort((a, b) => layerWidth(b) - layerWidth(a)))
      .join(
        enter => enter.append('path').call(enterLink => enterLink.append('title'))
      )
      .attr('d', link => {
        const {value: linkValue, source, target} = link;
        const {sourceLinks} = source;
        const {targetLinks} = target;
        const sourceValues = sourceLinks.map(({value}) => value);
        const targetValues = targetLinks.map(({value}) => value);
        const sourceIndex = sourceLinks.indexOf(link);
        const targetIndex = targetLinks.indexOf(link);
        const sourceNormalizer = sourceLinks.normalizer || (sourceLinks.normalizer = normalizeGenerator(sourceValues));
        const targetNormalizer = targetLinks.normalizer || (targetLinks.normalizer = normalizeGenerator(targetValues));
        const sourceX = source.x1;
        const targetX = target.x0;
        let sourceY = 0;
        let targetY = 0;
        for (let i = 0; i < sourceIndex; i++) {
          sourceY += sourceLinks[i].value;
        }
        for (let i = 0; i < targetIndex; i++) {
          targetY += targetLinks[i].value;
        }
        const sourceHeight = source.y1 - source.y0;
        const targetHeight = target.y1 - target.y0;
        // tslint:disable-next-line:no-bitwise
        const sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + source.y0;
        // tslint:disable-next-line:no-bitwise
        const targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + target.y0;
        // tslint:disable-next-line:no-bitwise
        const sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
        // tslint:disable-next-line:no-bitwise
        const targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
        // tslint:disable-next-line:no-bitwise
        const bezierX = (sourceX + targetX) / 2;
        return `M${sourceX} ${sourceY0}` +
          `C${bezierX} ${sourceY0},${bezierX} ${targetY0},${targetX} ${targetY0}` +
          `L${targetX} ${targetY1}` +
          `C${bezierX} ${targetY1},${bezierX} ${sourceY1},${sourceX} ${sourceY1}` +
          `Z`;
      })
      // .attr('stroke-width', ({width}) => Math.max(1, width))
      .attr('fill', ({schemaClass}) => schemaClass)
      .call(join =>
        join.selectAll('title')
          .text(({path}) => path)
      );
    d3.select(this.nodes.nativeElement)
      .selectAll('g')
      .data(words.nodes)
      .join(
        enter => enter.append('g')
          .attr('fill', ({color}) => color)
          .call(enterNode => enterNode.append('rect'))
          .call(enterNode =>
            enterNode.append('text')
              .attr('dy', '0.35em')
              .attr('text-anchor', 'end')
          )
          .call(enterNode => enterNode.append('title'))
          .call(e => this.enter.emit(e)),
        update => update,
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      .call(joined => joined.selectAll('rect')
        .attr('x', ({x0}) => x0)
        .attr('y', ({y0}) => y0)
        .attr('height', ({y0, y1}) => y1 - y0)
        .attr('width', ({x1, x0}) => x1 - x0)
        .attr('stroke', '#000')
      )
      .call(joined => joined.selectAll('text')
        .attr('x', ({x0}) => x0 - 6)
        .attr('y', ({y0, y1}) => (y1 + y0) / 2)
        .text(({displayName}) => displayName)
        .filter(({x0}) => x0 < width / 2)
        .attr('x', ({x1}) => x1 + 6)
        .attr('text-anchor', 'start')
      )
      .call(joined => joined.selectAll('title')
        .text(({name}) => name)
      );
  }
}
