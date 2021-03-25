import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  OnChanges,
  EventEmitter,
  Output,
  SimpleChanges
} from '@angular/core';

import { WordCloudFilterEntity } from 'app/interfaces/filter.interface';

import * as d3 from 'd3';
import * as cloud from 'd3.layout.cloud';
import { map, observeOn } from 'rxjs/operators';
import { BehaviorSubject, Subject, animationFrameScheduler } from 'rxjs';

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

export interface WordCloudNode {
  value?: any;
  result?: any;
  frequency: any;
  text?: any;
  shown?: any;
  id?: any;
  type?: any;
  color?: any;
}

/**
 * Generates a copy of the  data. The reason we do this is the word cloud layout algorithm actually mutates the input data. To
 * keep our API response data pure, we deep copy it and give the copy to the layout algorithm instead.
 */
function deepCopy(data) {
  return JSON.parse(JSON.stringify(data)) as WordCloudFilterEntity[];
}

const createResizeObserver = (callback, container) => {
  const resize = throttled(async (width, height) => {
    const w = container.clientWidth;
    await callback(width, height);
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

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WordCloudComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('cloudWrapper', {static: false}) cloudWrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @ViewChild('childrenContainer', {static: false}) childrenContainer!: ElementRef;

  clickableWords = false;
  WORD_CLOUD_MARGIN = 10;

  margin = {
    top: this.WORD_CLOUD_MARGIN,
    right: this.WORD_CLOUD_MARGIN,
    bottom: this.WORD_CLOUD_MARGIN,
    left: this.WORD_CLOUD_MARGIN
  };

  MIN_FONT = 12;
  MAX_FONT = 48;

  layout: any;
  resizeObserver: any;
  $wordElementsPipe;
  mutateData: false;

  enter(elements: any) {
    return elements
      .append('text')
      .style('fill', ({color}) => color)
      .attr('text-anchor', 'middle')
      .text(({text}) => text);
  }

  update(elements: any) {
    return elements;
  }

  join(elements: any) {
    return elements
      .style('font-size', (d) => d.size + 'px')
      .call((transElements: any) =>
        transElements
          .transition()
          .attr('transform', (d) => {
            return 'translate(' + [d.x, d.y] + ') rotate(' + d.rotate + ')';
          })
          .ease(d3.easeSin)
          .duration(1000)
      );
  }

  exit(elements: any) {
    return elements
      .remove();
  }

  @Input() data;
  @Output() dataChange = new EventEmitter<number>();
  @Input() responsive = true;
  @Input('layout') layoutPatch;

  @Output('enter') enterPatch: EventEmitter<any> = new EventEmitter();
  @Output('update') updatePatch: EventEmitter<any> = new EventEmitter();
  @Output('join') joinPatch: EventEmitter<any> = new EventEmitter();
  @Output('exit') exitPatch: EventEmitter<any> = new EventEmitter();

  layoutUpdate;

  $resize;

  resize() {
    this.$resize.next(this.getCloudSvgDimensions());
  }

  constructor() {
    this.$resize = new Subject().pipe(
      observeOn(animationFrameScheduler)
    );

    this.layout = cloud()
      .padding(3)
      // ~~ faster substitute for Math.floor() for positive numbers
      // http://rocha.la/JavaScript-bitwise-operators-in-practice
      // tslint:disable-next-line:no-bitwise
      .rotate(_ => 0);

    this.$wordElementsPipe = this.dataChange.pipe(
      map((data: any) => {
        const placedWords = data.filter(({shown}) => shown);
        const elements = d3.select(this.g.nativeElement)
          .selectAll('text')
          .data(placedWords, ({text}) => text);
        return this.join(
          elements
            .join(
              enter => this.enter(enter)
                .call(e =>
                  this.enterPatch.emit(e)
                ),
              update => this.update(update)
                .call(e => this.updatePatch.emit(e)),
              exit => this.exit(exit)
                .call(e => this.exitPatch.emit(e))
            )
        )
          .call(e => this.joinPatch.emit(e));
      })
    );

    this.layoutUpdate = new BehaviorSubject([]);
    const resizeCallback = function(entries) {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      // When its container's display is set to 'none' the callback will be called with a
      // size of (0, 0), which will cause the chart to lost its original height, so skip
      // resizing in such case.
      if (width === 0 && height === 0) {
        return;
      }
      this.$resize.next({width, height});
    };
    // @ts-ignore until https://github.com/microsoft/TypeScript/issues/37861 implemented
    this.resizeObserver = new ResizeObserver(resizeCallback.bind(this));
  }


  parseData(data) {
    const count: any = {};
    if (Array.isArray(data) && data.every(d => typeof d === 'string' && (count[d] = (count[d] || 0) + 1))) {
      return Object.entries(count).map(([text, frequency]) => ({text, frequency}));
    } else {
      return deepCopy(data);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const {
      data,
      responsive,
      layoutPatch
    } = changes;
    if (responsive) {
      this.setResizeObserver(responsive.currentValue);
    }
    if (layoutPatch) {
      this.layout = layoutPatch.currentValue(
        this.layout
      );
    }
    if (data) {
      this.layoutUpdate.next(this.parseData(data.currentValue));
    }
  }

  setResizeObserver(enabled) {
    if (enabled) {
      this.resizeObserver.observe(this.cloudWrapper.nativeElement);
    } else {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    }
  }

  ngAfterViewInit() {
    this.setResizeObserver(this.responsive);
    this.layout.canvas(this.hiddenTextAreaWrapper.nativeElement);
    this.$wordElementsPipe.subscribe(d => {
      console.log(`Word elements: ${d}`);
    });
    this.$resize.subscribe(this.onResize.bind(this));

    this.layoutUpdate.next(this.parseData(this.data));
    this.layoutUpdate.subscribe(data => this.updateLayout(data));
  }

  ngOnDestroy() {
    console.count('ngOnDestroy');
    this.resizeObserver.disconnect();
    delete this.resizeObserver;
  }

  onResize({width, height}) {
    // Get the svg element and update
    d3.select(this.svg.nativeElement)
      .attr('width', width)
      .attr('height', height);

    d3.select(this.childrenContainer.nativeElement)
      .attr('style', `left: ${width / 2}px; top: ${height / 2}px;`);

    // Get and update the grouping element
    d3.select(this.g.nativeElement)
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    this.layout.size([width, height]);

    return this.layoutUpdate.next(this.data);
  }

  /**
   * Given dataset return normalised font-size generator
   * @param data represents a collection of AnnotationFilterEntity data
   */
  fontSizeGenerator(data) {
    const freqValues = data.map(d => d.frequency as number);
    const maximumCount = Math.max(...freqValues);
    const minimumCount = Math.min(...freqValues);
    return d => this.getFontSize((d.frequency - minimumCount) / maximumCount);
  }

  getFontSize(normSize) {
    return this.MIN_FONT + (normSize || 0) * (this.MAX_FONT - this.MIN_FONT);
  }

  /**
   * Draws a word cloud with the given FilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of FilterEntity data
   */
  updateLayout(data: []) {
    if (data.length) {
      // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
      return this.layout
        .words(data)
        .fontSize(this.fontSizeGenerator(data))
        .on('end', placedWords => {
          const notPlaced = data.length - placedWords.length;
          if (notPlaced) {
            console.warn(`${notPlaced} words did not fit into cloud`);
          }
          this.dataChange.emit(this.data);
        })
        .start();
    } else {
      this.dataChange.emit([]);
    }
  }


  /**
   * Generates the width/height for the word cloud svg element. Uses the size of the wrapper element, minus a fixed margin. For example, if
   * the parent is 600px x 600px, and our margin is 10px, the size of the word cloud svg will be 580px x 580px.
   */
  private getCloudSvgDimensions() {
    const cloudWrapper = this.cloudWrapper.nativeElement;
    const {margin} = this;
    return {
      width: cloudWrapper.offsetWidth - margin.left - margin.right,
      height: cloudWrapper.offsetHeight - margin.top - margin.bottom
    };
  }
}
