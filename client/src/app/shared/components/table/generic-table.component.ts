import { Component, Input } from '@angular/core';

import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';
import { EnrichmentTableService } from 'app/enrichment-tables/services/enrichment-table.service';

@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss']
})
export class GenericTableComponent {
  HEADER: TableHeader[][];

  // Number of columns can be inferred from the headers
  numColumns: number[];

  constructor(
    protected readonly worksheetViewerService: EnrichmentTableService) {}

  // Probably don't need setters for all of these
  @Input()
  set header(header: TableHeader[][]) {
    this.HEADER = header;
    const num = Math.max.apply(null, header.map(x => x.reduce((a, b) => a + parseInt(b.span, 10), 0)));
    this.numColumns = new Array(num);
  }
  @Input() entries: TableCell[][];
  @Input() organism = '';
  @Input() taxID = '';

  annotate(entry) {
    this.worksheetViewerService.annotateEnrichment(
      {
        texts: [entry.text],
        organism: {
          organism_name: this.organism,
          synonym: this.organism,
          tax_id: this.taxID
        }
      } as TextAnnotationGenerationRequest).pipe().subscribe(results => entry.text = results);
  }

  formatText(text: string) {
    if (text.indexOf('snippet') === -1) {
      return `<snippet>${text}</snippet>`;
    } else {
      return text;
    }
  }
}

export interface TableCell {
  text: string;
  singleLink?: TableLink;
  multiLink?: TableLink[];
  highlight?: boolean;
}

export interface TableLink {
  link: string;
  linkText: string;
}

export interface TableHeader {
  name: string;
  span: string;
}
