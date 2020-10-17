import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { uniqueId } from 'lodash';

import { combineLatest, Subscription } from 'rxjs';

import { NodeLegend } from 'app/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
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
  id = uniqueId('WordCloudComponent-');

  projectName: string;
  fileId: string;
  fileName: string;

  loadTask: BackgroundTask<[], [PdfFile, NodeLegend, string]>;
  annotationsLoadedSub: Subscription;

  wordVisibilityMap: Map<string, boolean>;
  annotationData: WordCloudAnnotationFilterEntity[];

  legend: Map<string, string>;

  filtersPanelOpened: boolean;

  WORD_CLOUD_MARGIN = 10;

  constructor(
      readonly route: ActivatedRoute,
      private pdf: PdfFilesService,
      private wordCloudService: WordCloudService,
      private legendService: LegendService,
  ) {
    this.projectName = this.route.snapshot.params.project_name;
    this.fileId = this.route.snapshot.params.file_id;
    this.fileName = '';

    this.wordVisibilityMap = new Map<string, boolean>();
    this.annotationData = [];

    this.legend = new Map<string, string>();

    this.filtersPanelOpened = false;

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
      // Reset filename
      this.fileName = pdfFile.filename;

      // Reset legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      // Reset annotation data
      this.annotationData = [];
      this.wordVisibilityMap.clear();

      const tempIdTypePairSet = new Map<string, number>();
      const annotationList = annotationExport.split('\n');

      // remove the headers from tsv response
      annotationList.shift();
      // remove empty line at the end of the tsv response
      annotationList.pop();
      annotationList.forEach(e => {
        //  entity_id	  type	  text	  count
        //  col[0]      col[1]  col[2]  col[3]
        const cols = e.split('\t');
        const idTypePair = cols[0] + cols[1];

        if (!tempIdTypePairSet.has(idTypePair)) {
          const annotation = {
            id: cols[0],
            type: cols[1],
            color: this.legend.get(cols[1].toLowerCase()), // Set lowercase to match the legend
            text: cols[2],
            frequency: parseInt(cols[3], 10),
            shown: true,
          } as WordCloudAnnotationFilterEntity;
          this.wordVisibilityMap.set(this.getAnnotationIdentifier(annotation), true);
          this.annotationData.push(annotation);
          tempIdTypePairSet.set(idTypePair, this.annotationData.length - 1);
        } else {
          // Add the frequency of the synonym to the original word
          this.annotationData[tempIdTypePairSet.get(idTypePair)].frequency += parseInt(cols[3], 10);

          // TODO: In the future, we may want to show "synonyms" somewhere, or even allow the user to swap out the most frequent term for a
          // synonym
        }
      });

      // Need to sort the data, since we may have squashed some terms down and messed with the order given by the API
      this.annotationData = this.annotationData.sort((a, b) => b.frequency - a.frequency);

      // Need a slight delay between the data having been loaded and drawing the word cloud, seems like the BackgroundTask doesn't quite
      // adhere to the normal change detection cycle.
      setTimeout(() => {
        this.drawWordCloud(this.getFilteredAnnotationDeepCopy(), true);
      }, 10);
    });

    this.getAnnotationsForFile();
  }

  getAnnotationIdentifier(annotation: WordCloudAnnotationFilterEntity) {
    return annotation.id + annotation.type;
  }

  /**
   * Sends a request to the BackgroundTask object for new annotations data.
   */
  getAnnotationsForFile() {
    this.loadTask.update([]);
  }

  /**
   * Updates the word visibility map to match the input map. Called when the annotation filter wordVisibilityOutput emits.
   * @param newMap word visibility map to copy
   */
  updateWordVisibilityMap(newMap: Map<string, boolean>) {
    this.wordVisibilityMap.clear();
    newMap.forEach((val, key) => {
      this.wordVisibilityMap.set(key, val);
    });
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy(), false);
  }

  /**
   * Redraws the word cloud with updated dimensions to fit the current window.
   */
  fitCloudToWindow() {
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy(), false);
  }

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

  /**
   * Generates a copy of the annotation data. The reason we do this is the word cloud layout algorithm actually mutates the input data. To
   * keep our API response data pure, we deep copy it and give the copy to the layout algorithm instead.
   */
  private getAnnotationDataDeepCopy() {
    return JSON.parse(JSON.stringify(this.annotationData)) as WordCloudAnnotationFilterEntity[];
  }

  /**
   * Gets a filtered copy of the annotation data. Any word not mapped to 'true' in the wordVisibilityMap will be filtered out.
   */
  private getFilteredAnnotationDeepCopy() {
    return this.getAnnotationDataDeepCopy().filter(annotation => this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation)));
  }

  /**
   * Updates the 'shown' property of the words in annotationData. This property denotes whether the word cloud could draw the word within
   * the given width/height/size constraints. To simplify, each word essentially has three states:
   *
   *   1. The word is visible in the cloud
   *   2. The word is not visible in the cloud, because it was filtered and not considered in the layout algorithm
   *   3. The word is not visible in the cloud, because it could not be drawn with the given size within the given width/height of the
   *    container element
   *
   * This function determines the state of each input word.
   * @param words list of objects representing word data
   */
  private updateWordVisibility(words: WordCloudAnnotationFilterEntity[]) {
    const tempWordMap = new Map<string, WordCloudAnnotationFilterEntity>();
    words.forEach((word) => {
      tempWordMap.set(word.text, word);
    });

    for (const word of this.annotationData) {
      // If the word was returned by the algorithm then it is not filtered and it is drawable
      if (tempWordMap.has(word.text)) {
        word.shown = true;
      } else {
        // If it wasn't returned BUT it's been filtered, we don't need to show a warning
        if (!this.wordVisibilityMap.get(this.getAnnotationIdentifier(word))) {
          word.shown = true;
        } else {
          // If it wasn't returned but it HASN'T been filtered, we need to show a warning
          word.shown = false;
        }
      }
    }
  }

  /**
   * Generates the width/height for the word cloud svg element. Uses the size of the wrapper element, minus a fixed margin. For example, if
   * the parent is 600px x 600px, and our margin is 10px, the size of the word cloud svg will be 580px x 580px.
   */
  private getCloudSvgDimensions() {
    const margin = {
      top: this.WORD_CLOUD_MARGIN,
      right: this.WORD_CLOUD_MARGIN,
      bottom: this.WORD_CLOUD_MARGIN,
      left: this.WORD_CLOUD_MARGIN
    };
    const width = (document.getElementById(`${this.id}cloud-wrapper`).offsetWidth) - margin.left - margin.right;
    const height = (document.getElementById(`${this.id}cloud-wrapper`).offsetHeight) - margin.top - margin.bottom;

    return {width, height};
  }

  /**
   * Creates the word cloud svg and related elements. Also creates 'text' elements for each value in the 'words' input.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  private createInitialWordCloudElements(words: WordCloudAnnotationFilterEntity[]) {
    this.updateWordVisibility(words);

    const {width, height} = this.getCloudSvgDimensions();

    // Append the svg element to the wrapper, append the grouping element to the svg, and create initial words
    d3.select(`#${this.id}cloud-wrapper`)
      .append('svg')
        .attr('width', width)
        .attr('height', height)
      .append('g')
        .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
      .selectAll('text')
      .data(words, (d) => d.text)
      .enter()
      .append('text')
        .style('fill', (d) => d.color)
        .attr('text-anchor', 'middle')
        .style('font-size', (d) =>  d.size + 'px')
        .transition()
        .attr('transform', (d) => {
          return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
        })
        .text((d) => d.text)
        .ease(d3.easeSin)
        .duration(1000);
  }

  /**
   * Updates the word cloud svg and related elements. Distinct from createInitialWordCloudElements in that it finds the existing elements
   * and updates them if possible. Any existing words will be re-scaled and moved to their new positions, removed words will be removed,
   * and added words will be drawn.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  private updateWordCloudElements(words: WordCloudAnnotationFilterEntity[]) {
    this.updateWordVisibility(words);

    // Set the dimensions and margins of the graph
    const {width, height} = this.getCloudSvgDimensions();

    // Get the svg element and update
    const svg = d3.select(`#${this.id}cloud-wrapper`)
      .select('svg')
        .attr('width', width)
        .attr('height', height);

    // Get and update the grouping element
    const g = svg
                .select('g')
                  .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    // Get the word elements
    const wordElements = g.selectAll('text').data(words, (d) => d.text);

    // Add any new words
    wordElements
      .enter()
      .append('text')
      .merge(wordElements)
        .style('fill', (d) => d.color)
        .attr('text-anchor', 'middle')
        .text((d) => d.text)
        .style('font-size', (d) =>  d.size + 'px')
        .transition()
        .attr('transform', (d) => {
          return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
        })
        .ease(d3.easeSin)
        .duration(1000);

    // Remove any words that have been removed by either the algorithm or the user
    wordElements.exit().remove();
  }

  /**
   * Draws a word cloud with the given AnnotationFilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of AnnotationFilterEntity data
   */
  private drawWordCloud(data: WordCloudAnnotationFilterEntity[], initial: boolean) {
    // Reference for this code: https://www.d3-graph-gallery.com/graph/wordcloud_basic
    const {width, height} = this.getCloudSvgDimensions();
    const maximumCount = Math.max(...data.map(annotation => annotation.frequency as number));

    // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
    const layout = cloud()
      .size([width, height])
      .words(data)
      .padding(3)
      // max ~48px, min ~12px
      .fontSize((d) => ((d.frequency / maximumCount) * 36) + 12)
      .rotate(() => 0)
      // TODO: Maybe in the future we can allow the user to define their own rotation intervals,
      // but for now just keep it simple and don't rotate the words
      /* tslint:disable:no-bitwise*/
      // .rotate(() => (~~(Math.random() * 8) - 3) * 15)
      .on('end', words => initial ? this.createInitialWordCloudElements(words) : this.updateWordCloudElements(words));
    layout.start();
  }
}
