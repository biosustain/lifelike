import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { FTSQueryRecord, SearchQuery } from 'app/interfaces';
import * as SearchActions from '../store/actions';
import * as SearchSelectors from '../store/selectors';
import { State } from 'app/***ARANGO_USERNAME***-store';

@Component({
    selector: 'app-search-graph',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <app-search-bar
            [query]="query$ | async"
            (search)="search($event)"
        ></app-search-bar>
    `,
})
export class SearchGraphComponent {
    query$: Observable<string>;
    nodes$: Observable<FTSQueryRecord[]>;
    loading$: Observable<boolean>;

    constructor(private store: Store<State>) {
        this.loading$ = store.pipe(select(SearchSelectors.selectSearchLoading));
        this.query$ = store.pipe(select(SearchSelectors.selectSearchQuery));
    }

    search(searchQuery: SearchQuery) {
        this.store.dispatch(SearchActions.search({ searchQuery }));
    }
}
