import { Component, Input, EventEmitter, Output, OnChanges } from '@angular/core';
import { FTSQueryRecord, SearchQuery } from 'app/interfaces';

@Component({
    selector: 'app-search-list',
    templateUrl: './search-list.component.html',
    styleUrls: ['./search-list.component.scss'],
})
export class SearchListComponent implements OnChanges {
    @Input() nodes: FTSQueryRecord[];
    @Input() totalRecords: number;
    @Input() currentPage: number;
    @Input() currentLimit: number;
    @Input() currentQuery: string;
    @Output() showMore = new EventEmitter<{searchQuery: SearchQuery}>();

    // Shows/Hides the show more button
    showMoreVisible: boolean;

    constructor() {}

    ngOnChanges() {
        if (this.nodes) {
            this.showMoreVisible = this.nodes.length < this.totalRecords;
        } else {
            this.showMoreVisible = false;
        }
    }

    getMoreResults() {
        const searchQuery = {
            query: this.currentQuery,
            page: this.currentPage + 1,
            limit: this.currentLimit,
        };
        this.showMore.emit({searchQuery});
    }
}
