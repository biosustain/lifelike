import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
} from '@angular/core';
import {
    FTSQueryRecord,
    SearchRecord
} from 'app/interfaces';

@Component({
    selector: 'app-search-list',
    templateUrl: './search-list.component.html',
    styleUrls: ['./search-list.component.scss'],
})
export class SearchListComponent implements OnChanges {

    // Shows/Hides the 'no results' info card
    showNoResultsWarning = false;

    displayResults: Array<SearchRecord> = [];

    @Output() navigateToViz = new EventEmitter();
    @Output() fetchMoreResults = new EventEmitter();
    @Input() searchResults: Array<FTSQueryRecord>;
    // Shows/Hides 'show more' button
    @Input() showMoreVisible = false;
    // Optional total results amount display
    @Input() totalResultsAmount: number;
    // Optional search term to display
    @Input() searchTerm: string;

    constructor() {}

    ngOnChanges() {
        if (this.searchResults) {
            this.showNoResultsWarning = true;
            this.displayResults = this.searchResults.map(result => this.convertToRecord(result));
        }
    }

    showMore() {
        this.fetchMoreResults.emit();
    }

    navigateToVisualizer() {
        this.totalResultsAmount = 0;
        this.showNoResultsWarning = false;
        this.navigateToViz.emit();
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
