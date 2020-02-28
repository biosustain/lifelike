import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, tap, take } from 'rxjs/operators';
import * as SearchActions from '../store/actions';
import * as SearchSelectors from '../store/selectors';
import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';
import { FTSQueryRecord, SearchQuery } from 'app/interfaces';

@Component({
    selector: 'app-search-collection-page',
    template: `<app-search-list
                    [totalRecords]="totalRecords$ | async"
                    [nodes]="nodes$ | async"
                    [currentPage]="currentPage$ | async"
                    [currentLimit]="currentLimit$ | async"
                    [currentQuery]="currentQuery$ | async"
                    (showMore)="showMore($event)"
                ></app-search-list>`,
})
export class SearchCollectionPageComponent implements OnInit {
    nodes$: Observable<FTSQueryRecord[]>;
    totalRecords$: Observable<number>;
    currentPage$: Observable<number>;
    currentLimit$: Observable<number>;
    currentQuery$: Observable<string>;

    constructor(
        private route: ActivatedRoute,
        private store: Store<State>,
    ) {
        this.currentLimit$ = store.pipe(select(SearchSelectors.selectSearchLimit));
        this.currentPage$ = store.pipe(select(SearchSelectors.selectSearchPage));
        this.currentQuery$ = store.pipe(select(SearchSelectors.selectSearchQuery));
        this.nodes$ = store.pipe(select(SearchSelectors.selectSearchRecords));
        this.totalRecords$ = store.pipe(select(SearchSelectors.selectSearchTotal));
    }

    ngOnInit() {
        this.route.queryParams.pipe(
            filter(params => params.q),
            tap((params) => {
                const searchQuery = {
                    query: params.q,
                    page: 1,
                    limit: 10,
                };
                this.store.dispatch(SearchActions.search({searchQuery}));
            }),
            take(1),
        ).subscribe();
    }

    showMore(searchQuery: {searchQuery: SearchQuery}) {
        this.store.dispatch(SearchActions.searchPaginate(searchQuery));
    }
}
