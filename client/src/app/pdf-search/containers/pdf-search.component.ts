import {Component, ViewEncapsulation} from '@angular/core';
import {PDFResult} from '../../interfaces';

@Component({
  selector: 'app-pdf-search-collection-page',
  styles: ['.highlight {border: 2px solid red}'],
  template: `
    <app-pdf-search-bar
      (results)="getResults($event)"
    ></app-pdf-search-bar>
    <app-pdf-search-results
      [searchResults]="dataSource"
    >
    </app-pdf-search-results>
  `,
  encapsulation: ViewEncapsulation.None
})

export class PdfSearchComponent {
  dataSource: PDFResult;

  getResults(results) {
    this.dataSource = results;
  }
}
