import { Component, Input, EventEmitter, Output, OnChanges } from '@angular/core';
import { FTSQueryRecord, SearchQuery } from 'app/interfaces';

@Component({
    selector: 'app-search-list',
    template: `
        <mat-card>
            <mat-card-title>Showing results for "{{ currentQuery }}"</mat-card-title>
            <mat-card-subtitle>About {{ totalRecords }} results.</mat-card-subtitle>
            <div class="search-record-container" *ngFor="let n of nodes; let i = index" [ngSwitch]="n.node.label">
                <app-search-record-relationships [node]="n" *ngSwitchCase="'Reference'"></app-search-record-relationships>
                <app-search-record-node [node]="n" *ngSwitchDefault></app-search-record-node>
                <mat-card class="mat-elevation-z1" *ngIf="(i % 10) === 0 && i !== 0">
                    <mat-card-subtitle>Page {{ i/10 }}</mat-card-subtitle>
                </mat-card>
            </div>
            <div id="search-show-more-btn" *ngIf="showMoreVisible">
                <button color="primary" mat-raised-button visClickDebounce (debounceClick)="getMoreResults()">More Results</button>
            </div>
        </mat-card>
    `,
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
