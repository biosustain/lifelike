import { Component, Input, EventEmitter, Output } from '@angular/core';

import { FTSQueryRecord, SearchQuery } from 'app/interfaces';

@Component({
    selector: 'app-search-list',
    templateUrl: './search-list.component.html',
    styleUrls: ['./search-list.component.scss'],
})
export class SearchListComponent {
    @Input() records: FTSQueryRecord[];
    @Input() totalRecords: number;
    @Input() currentPage: number;
    @Input() currentLimit: number;
    @Input() currentQuery: string;
    @Input() legend: Map<string, string>;
    @Output() showMore = new EventEmitter<SearchQuery>();

    constructor() {}

    getMoreResults() {
        const searchQuery = {
            query: this.currentQuery,
            page: this.currentPage + 1,
            limit: this.currentLimit,
        };
        this.showMore.emit(searchQuery);
    }
}
