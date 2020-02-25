import { Component, Input, OnChanges } from '@angular/core';
import { FTSQueryRecord, SearchRecord } from 'app/interfaces';

@Component({
    selector: 'app-search-list',
    templateUrl: './search-list.component.html',
    styleUrls: ['./search-list.component.scss'],
})
export class SearchListComponent implements OnChanges {

    displayResults: Array<SearchRecord> = [];

    @Input() searchResults: Array<FTSQueryRecord>;

    constructor() {}

    ngOnChanges() {
        if (this.searchResults) {
            this.displayResults = this.searchResults.map(d => this.convertToRecord(d));
        }
    }

    convertToRecord(record: FTSQueryRecord): SearchRecord {
        const node = record.node;
        switch (node.label) {
            case 'Disease':
                return {
                    nodeId: node.id,
                    label: node.label,
                    subLabels: node.subLabels,
                    data: node.displayName,
                    dataId: node.data.id,
                } as SearchRecord;
            case 'Gene':
                return {
                    nodeId: node.id,
                    label: node.label,
                    subLabels: node.subLabels,
                    data: node.displayName,
                    dataId: node.data.id,
                } as SearchRecord;
            case 'Chemical':
                return {
                    nodeId: node.id,
                    label: node.label,
                    subLabels: node.subLabels,
                    data: node.displayName,
                    dataId: node.data.id,
                } as SearchRecord;
            case 'Taxonomy':
                return {
                    nodeId: node.id,
                    label: node.label,
                    subLabels: node.subLabels,
                    data: node.displayName,
                    dataId: node.data.id,
                } as SearchRecord;
            case 'Reference':
                return {
                    nodeId: node.id,
                    label: node.label,
                    subLabels: node.subLabels,
                    data: node.data.sentence,
                    dataId: node.data.id,
                } as SearchRecord;
            default:
                return;
        }
    }
}
