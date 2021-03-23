import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation, ViewChild } from '@angular/core';


import { uniqueId } from 'lodash';

import { combineLatest, Subscription, BehaviorSubject } from 'rxjs';

import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';

import { fileTypeSortingAlgorithms } from '../sorting/sorting-algorithms';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { AnnotationsService } from '../../../file-browser/services/annotations.service';
import { NodeLegend } from '../../../interfaces';
import { SortingAlgorithm } from '../../../shared/schemas/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-navigator-cloud-viewer',
  templateUrl: './navigator-cloud-viewer.component.html',
  styleUrls: ['./navigator-cloud-viewer.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NavigatorCloudViewerComponent implements OnInit, OnDestroy {
  id = uniqueId('WordCloudComponent-');

  @Input() title = 'Entity Cloud';
  @Input() object: FilesystemObject;
  @Input() clickableWords = false;
  @Output() wordOpen = new EventEmitter<WordOpen>();
  @ViewChild('wordCloudTooltip', {static: false}) wordCloudTooltip;

  loadTask: BackgroundTask<any, [NodeLegend, string]>;
  annotationsLoadedSub: Subscription;

  wordCloudTooltipPseudoElementPosition;
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  annotationData: WordCloudAnnotationFilterEntity[];
  filtersPanelOpened = false;

  legend: Map<string, string> = new Map<string, string>();

  MAX_ALGO_INPUT = 1000;
  FONT_MIN = 12;
  FONT_MAX = 48;

  data;

  sorting: SortingAlgorithm;
  sortingAlgorithms: SortingAlgorithm[];

  keywordsShown = true;
  layoutOverwrite;

  @ViewChild('wordCloud', {static: false}) wordCloud;

  get d3Tooltip() {
    // Get the tooltip for the word cloud text (this should already be present in the DOM)
    return d3.select(this.wordCloudTooltip.nativeElement);
  }

  enter(elements) {
    return elements
      .on('click', (item: WordCloudAnnotationFilterEntity) => {
        this.wordOpen.emit({
          entity: item,
          keywordsShown: this.keywordsShown,
        });
      });
  }

  join(elements) {
    // Also create a function for the tooltip content, to be shown when the text is hovered over
    const mouseenter = d => {
      this.d3Tooltip
        .html(this.keywordsShown ? `Primary Name: ${d.primaryName}` : `Text in Document: ${d.keyword}`)
        .style('display', 'block')
        .style('left', d.x + 'px')
        .style('top', (d.y + d.y0) + 'px');
    };
    return elements
      .attr('class', 'cloud-word' + (this.clickableWords ? ' cloud-word-clickable' : ''))
      .on('mouseenter', mouseenter.bind(this))
      .on('mouseleave', () => this.d3Tooltip.style('display', 'none'));
  }

  layout(layout) {
    return layout
      .padding(1)
      .rotate(_ => 0);
  }

  constructor(protected readonly annotationsService: AnnotationsService,
              protected readonly legendService: LegendService) {
    // Initialize the background task
    this.loadTask = new BackgroundTask(({hashId, sortingId}) => {
      return combineLatest(
        this.legendService.getAnnotationLegend(),
        this.annotationsService.getSortedAnnotations(hashId, sortingId),
      );
    });

    this.wordCloudTooltipPseudoElementPosition = new BehaviorSubject({});
  }

  ngOnInit() {
    const sortingForFileType = fileTypeSortingAlgorithms[this.object.mimeType];
    this.sorting = sortingForFileType.default;
    this.sortingAlgorithms = sortingForFileType.all;

    // Set the background task callback
    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({result: [legend, annotationExport]}) => {
      // Reset legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      this.setAnnotationData(annotationExport);
    });

    // Send initial data request
    this.getAnnotations();
  }

  ngOnDestroy() {
    this.annotationsLoadedSub.unsubscribe();
  }

  getAnnotationIdentifier(annotation: WordCloudAnnotationFilterEntity) {
    return annotation.id + annotation.type + annotation.keyword;
  }

  /**
   * Sends a request to the BackgroundTask object for new annotations data.
   */
  getAnnotations() {
    this.loadTask.update({hashId: this.object.hashId, sortingId: this.sorting.id});
  }

  sort(algorithm) {
    this.sorting = algorithm;
    this.getAnnotations();
  }

  setAnnotationData(annotationExport: string) {
    // Reset annotation data
    const annotationData = [];
    this.wordVisibilityMap.clear();

    const uniquePairMap = new Map<string, number>();
    const annotationList = annotationExport.split('\n');

    // remove the headers from tsv response
    annotationList.shift();
    // remove empty line at the end of the tsv response
    annotationList.pop();
    annotationList.forEach(e => {
      //  entity_id	  type	  text	  primary_name  value
      //  col[0]      col[1]  col[2]  col[3]        col[4]
      const cols = e.split('\t');
      const uniquePair = cols[0] === '' ? cols[1] + cols[2] : cols[0] + cols[1];

      if (!uniquePairMap.has(uniquePair)) {
        const annotation = {
          id: cols[0],
          type: cols[1],
          color: this.legend.get(cols[1].toLowerCase()), // Set lowercase to match the legend
          keyword: cols[2],
          primaryName: cols[3],
          text: cols[2],
          frequency: Number(cols[4]),
          shown: true,
        } as WordCloudAnnotationFilterEntity;
        this.wordVisibilityMap.set(
          this.getAnnotationIdentifier(annotation),
          this.sorting.min === undefined || annotation.frequency >= this.sorting.min,
        );
        annotationData.push(annotation);
        uniquePairMap.set(uniquePair, annotationData.length - 1);
      } else {
        // Add the frequency of the synonym to the original word
        annotationData[uniquePairMap.get(uniquePair)].frequency += parseInt(cols[4], 10);

        // And also update the word visibility, since the original frequency might have been 1
        this.wordVisibilityMap.set(this.getAnnotationIdentifier(annotationData[uniquePairMap.get(uniquePair)]), true);

        // TODO: In the future, we may want to show "synonyms" somewhere, or even allow the user to swap out the most frequent term for a
        // synonym
      }
    });

    // Need to sort the data, since we may have squashed some terms down and messed with the order given by the API
    this.annotationData = annotationData.sort((a, b) => b.frequency - a.frequency);
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
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  /**
   * Redraws the word cloud with updated dimensions to fit the current window.
   */
  fitCloudToWindow() {
    this.wordCloud.resize();
    // this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

  fittedWords;

  fittedWordsCallback(fittedWords) {
    this.fittedWords = fittedWords;
  }

  /**
   * Updates the word cloud text to the primary names of each entity, and vice versa.
   */
  toggleShownText() {
    this.annotationData = this.annotationData.map(annotation => {
      annotation.text = this.keywordsShown ? annotation.primaryName : annotation.keyword;
      return annotation;
    });
    this.keywordsShown = !this.keywordsShown;
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  copyWordCloudToClipboard() {
    // TODO
    // const hiddenTextAreaWrapper = this.hiddenTextAreaWrapperEl.nativeElement;
    // hiddenTextAreaWrapper.style.display = 'block';
    const tempTextArea = document.createElement('textarea');

    // hiddenTextAreaWrapper.appendChild(tempTextArea);
    this.annotationData.forEach(annotation => {
      if (this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation))) {
        tempTextArea.value += `${annotation.text}\n`;
      }
    });
    tempTextArea.select();
    document.execCommand('copy');

    // hiddenTextAreaWrapper.removeChild(tempTextArea);
    // hiddenTextAreaWrapper.style.display = 'none';
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
  getFilteredAnnotationDeepCopy() {
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
      tempWordMap.set(word.keyword, word);
    });

    for (const word of this.annotationData) {
      // If the word was returned by the algorithm then it is not filtered and it is drawable
      if (tempWordMap.has(word.keyword)) {
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
   * Draws a word cloud with the given AnnotationFilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of AnnotationFilterEntity data
   */
  drawWordCloud(data: WordCloudAnnotationFilterEntity[]) {
    this.updateWordVisibility(data);
    this.data = data.length > this.MAX_ALGO_INPUT ? data.slice(0, this.MAX_ALGO_INPUT) : data;
  }
}

class WordOpen {
  entity: WordCloudAnnotationFilterEntity;
  keywordsShown: boolean;
}
