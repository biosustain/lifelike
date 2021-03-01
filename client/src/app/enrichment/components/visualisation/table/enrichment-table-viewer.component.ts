import { Component, Input } from '@angular/core';


export const ENRICHMENT_VISUALISATION_MIMETYPE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-visualisation';

@Component({
  selector: 'app-enrichment-visualisation-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent {
  // Inputs for Generic Table Component
  tableEntries;
  tableHeader;

  _data = undefined;

  @Input()
  set data(data) {
    this.tableHeader = [Object.keys(data[0]).map(header => ({name: header, span: 1}))];
    this.tableEntries = data.map(row => Object.values(row).map(cell => ({text: '' + cell})));
    this._data = data;
  }

  get data() {
    return this._data;
  }

  @Input() showMore = true;
}


export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
