import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';


import { uniqueId } from 'lodash';

import { combineLatest, Subscription } from 'rxjs';

import { NodeLegend } from 'app/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { Word } from 'app/interfaces/word-cloud.interface';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import { WordCloudService } from './services/word-cloud.service';

import * as d3 from 'd3';
import * as cloud from 'd3.layout.cloud';

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss']
})

export class WordCloudComponent {
  @ViewChild('dropdown', {static: false, read: NgbDropdown}) dropdownComponent: NgbDropdown;
  id = uniqueId('WordCloudComponent-');

  projectName: string;
  fileId: string;
  fileName: string;

  loadTask: BackgroundTask<[], [PdfFile, NodeLegend, string]>;
  annotationsLoadedSub: Subscription;

  wordVisibilityMap: Map<string, boolean>;
  wordVisibilityChanged: boolean;

  annotationData: Word[];

  legend: Map<string, string>;

  constructor(
      readonly route: ActivatedRoute,
      private pdf: PdfFilesService,
      private wordCloudService: WordCloudService,
      private legendService: LegendService,
  ) {
    this.projectName = this.route.snapshot.params.project_name;
    this.fileId = this.route.snapshot.params.file_id;

    this.legend = new Map<string, string>();
    this.annotationData = [];
    this.wordVisibilityMap = new Map<string, boolean>();
    this.wordVisibilityChanged = false;
    this.fileName = '';

    this.loadTask = new BackgroundTask(() => {
      return combineLatest(
        this.pdf.getFileMeta(this.fileId, this.projectName),
        this.legendService.getAnnotationLegend(),
        this.wordCloudService.getCombinedAnnotations(this.projectName, this.fileId),
      );
    });

    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({
      result: [pdfFile, legend, annotationExport],
      value: [],
    }) => {
      // Setup filename
      this.fileName = pdfFile.filename;

      // Setup legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      // Setup annotation data
      const annotationList = annotationExport.split('\n');
      this.annotationData = [];
      this.wordVisibilityMap.clear();

      // remove the headers from tsv response
      annotationList.shift();
      // remove empty line at the end of the tsv response
      annotationList.pop();
      annotationList.forEach(e => {
        const cols = e.split('\t');
        const annotation = {
          color: this.legend.get(cols[1].toLowerCase()), // Set lowercase to match the legend
          text: cols[2],
          value: parseInt(cols[3], 10),
        } as Word;
        this.wordVisibilityMap.set(annotation.text, true);
        this.annotationData.push(annotation);
      });
      setTimeout(() => {
        this.drawWordCloud(this.getAnnotationDataDeepCopy());
      }, 10);
    });

    this.getAnnotationsForFile();
  }

  /**
   * Closes the word cloud term dropdown widget.
   */
  closeFilterPopup() {
    this.dropdownComponent.close();
  }

  /**
   * Sends a request to the BackgroundTask object for new annotations data.
   */
  getAnnotationsForFile() {
    this.loadTask.update([]);
  }

  getAnnotationDataDeepCopy() {
    return JSON.parse(JSON.stringify(this.annotationData)) as Word[];
  }

  getFilteredAnnotationDeepCopy() {
    return this.getAnnotationDataDeepCopy().filter(annotation => this.wordVisibilityMap.get(annotation.text));
  }

  isWordVisible(word: string) {
    const value = this.wordVisibilityMap.get(word);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  /**
   * Changes the filter state of the given word to the given input state.
   * @param word string representing the word to change the state of
   * @param event checkbox event object containing the new state
   */
  changeWordVisibility(word: string, event) {
    this.wordVisibilityMap.set(word, event.target.checked);
    this.invalidateWordVisibility();
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  /**
   * Sets all words in the word visibility map to the input state.
   * @param state boolean true/false representing a filter state for the word cloud
   */
  setAllWordsVisibility(state: boolean) {
    for (const annotation of this.annotationData) {
      this.wordVisibilityMap.set(annotation.text, state);
    }
    this.invalidateWordVisibility();
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  /**
   * Determines whether any words in the word cloud have been filtered. By default words are not filtered, so if any of them are, then we
   * know that the user changed the filter. We use this to determine which (if any) of the buttons on the widget to disable/enable.
   */
  invalidateWordVisibility() {
    // Keep track if the user has some entity types disabled
    let wordVisibilityChanged = false;
    for (const value of this.wordVisibilityMap.values()) {
      if (!value) {
        wordVisibilityChanged = true;
        break;
      }
    }
    this.wordVisibilityChanged = wordVisibilityChanged;
  }

  /**
   * Redraws the word cloud with updated dimensions to fit the current window.
   */
  fitCloudToWindow() {
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  /**
   * Draws a word cloud with the given Word inputs using the d3.layout.cloud library.
   * @param data represents a collection of Word data
   */
  private drawWordCloud(data: Word[]) {
    // Reference for this code: https://www.d3-graph-gallery.com/graph/wordcloud_basic

    // Set the dimensions and margins of the graph
    const margin = {top: 10, right: 10, bottom: 10, left: 10};
    const width = (document.getElementById(`${this.id}cloud-wrapper`).offsetWidth) - margin.left - margin.right;
    const height = (document.getElementById(`${this.id}cloud-wrapper`).offsetHeight) - margin.top - margin.bottom;

    // Remove any stuff we already put in the word cloud wrapper
    d3.select(`#${this.id}cloud-wrapper`).selectAll('*').remove();

    // Append the svg object to the wrapper
    const svg = d3.select(`#${this.id}cloud-wrapper`).append('svg')
        .attr('width', width)
        .attr('height', height);

    const maximumCount = Math.max(...data.map(annotation => annotation.value as number));

    // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
    const layout = cloud()
      .size([width, height])
      .words(data)
      .padding(3)
      // max ~86px, min ~12px
      .fontSize((d) => ((d.value / maximumCount) * 74) + 12)
      /* tslint:disable:no-bitwise*/
      .rotate(() => (~~(Math.random() * 8) - 3) * 15)
      .on('end', draw);
    layout.start();

    // This function takes the output of 'layout' above and draws the words
    function draw(words) {
      svg
        .append('g')
          .attr('transform', 'translate(' + layout.size()[0] / 2 + ',' + layout.size()[1] / 2 + ')')
          .selectAll('text')
            .data(words)
          .enter().append('text')
            .style('font-size', (d) =>  d.size + 'px')
            .style('fill', (d) => d.color)
            .attr('text-anchor', 'middle')
            .attr('transform', (d) => {
              return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
            })
            .text((d) => d.text);
    }
  }
}
