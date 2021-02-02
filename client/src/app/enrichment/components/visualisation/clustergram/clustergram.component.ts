import {
  AfterViewInit,
  Component,
  Input,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';

import {uniqueId} from 'lodash';

import {WordCloudFilterEntity} from 'app/interfaces/filter.interface';

import * as d3 from 'd3';
import * as cloud from 'd3.layout.cloud';


interface Node {
  value?: any;
  result?: any;
  frequency: any;
  text?: any;
  shown?: any;
  id?: any;
  type?: any;
  color?: any;
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ClustergramComponent implements AfterViewInit {
  id = uniqueId('WordCloudComponent-');

  @Output() wordOpen = new EventEmitter<WordCloudFilterEntity>();

  @ViewChild('cloudWrapper', {static: false}) cloudWrapper!: ElementRef<any>;

  @Input('data') set data(data) {
    this._data = data.slice(10).map(d => ({...d, Genes: d.Genes.split(';')}));
  }

  get data() {
    return this._data;
  }

  private _data: any[] = [];

  clickableWords = false;
  WORD_CLOUD_MARGIN = 10;

  margin = {
    top: this.WORD_CLOUD_MARGIN,
    right: this.WORD_CLOUD_MARGIN,
    bottom: this.WORD_CLOUD_MARGIN,
    left: this.WORD_CLOUD_MARGIN
  };

  ngAfterViewInit() {
    this.drawWordCloud(this.getDataDeepCopy(), true);
  }

  getIdentifier(d: WordCloudFilterEntity) {
    return d.id + d.type + d.text;
  }

  MIN_FONT = 12;
  MAX_FONT = 48;

  getfontSize(norm_size) {
    return this.MIN_FONT + norm_size * (this.MAX_FONT - this.MIN_FONT);
  }

  /**
   * Draws a word cloud with the given FilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of FilterEntity data
   * @param initial - is it first render?
   */
  drawWordCloud(data: WordCloudFilterEntity[], initial: boolean) {
    // Reference for this code: https://www.d3-graph-gallery.com/graph/wordcloud_basic
    const {width, height} = this.getCloudSvgDimensions();
    const maximumCount = Math.max(...data.map(d => d.frequency as number));

    // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
    const layout = cloud()
      .size([width, height])
      .words(data)
      .padding(3)
      // max ~48px, min ~12px
      .fontSize(d => this.getfontSize((d.frequency - 1) / maximumCount))
      .on('end', words => this.initUpdate(words, initial));
    layout.start();
  }

  /**
   * Generates a copy of the  data. The reason we do this is the word cloud layout algorithm actually mutates the input data. To
   * keep our API response data pure, we deep copy it and give the copy to the layout algorithm instead.
   */
  private getDataDeepCopy() {
    return JSON.parse(JSON.stringify(this.data)) as WordCloudFilterEntity[];
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
  private initUpdate(words, init) {
    const operation = init ? 'append' : 'select';

    const {width, height} = this.getCloudSvgDimensions();

    // Get the svg element and update
    const svg = d3.select(this.cloudWrapper.nativeElement)
      [operation]('svg')
      .attr('width', width)
      .attr('height', height);

    // Get and update the grouping element
    const g = svg
      [operation]('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    // Get the word elements
    const wordElements = g
      .selectAll('text')
      .data(words, (d) => d.text);

    // Remove any words that have been removed by either the algorithm or the user
    wordElements.exit().remove();

    // Add any new words
    return wordElements
      .enter()
      .append('text')
      .merge(wordElements)
      .style('fill', (d) => d.color)
      .attr('text-anchor', 'middle')
      .text((d) => d.text)
      .on('click', (item: WordCloudFilterEntity) => {
        this.wordOpen.emit(item);
      })
      .attr('class', 'cloud-word' + (this.clickableWords ? ' cloud-word-clickable' : ''))
      .transition()
      .attr('transform', (d) => {
        return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
      })
      .ease(d3.easeSin)
      .duration(1000);
  }
}
