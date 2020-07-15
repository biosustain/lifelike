import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {PDFResult, PDFSnippets} from '../../interfaces';

@Component({
  selector: 'app-pdf-search-results',
  templateUrl: './pdf-search-results.component.html',
  styleUrls: ['./pdf-search-results.component.scss']
})
export class PdfSearchResultsComponent implements OnInit, OnChanges {
  @Input() searchResults: PDFResult = {hits: [{} as PDFSnippets], maxScore: 0, total: 0};
  snippets: Array<PDFSnippets> = new Array<PDFSnippets>();

  constructor() {
  }

  ngOnInit() {

  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      if (changes.hasOwnProperty(propertyName)) {
        const propertyChanges = changes[propertyName];
        const current = JSON.stringify(propertyChanges.currentValue);
        const previous = JSON.stringify(propertyChanges.previousValue);
        if (current !== previous) {
         this.snippets = this.searchResults.hits;
        }
      }
    }
  }

}
