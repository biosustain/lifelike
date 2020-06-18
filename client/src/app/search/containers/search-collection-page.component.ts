import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, tap, take } from 'rxjs/operators';
import * as SearchActions from '../store/actions';
import * as SearchSelectors from '../store/selectors';
import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';
import { FTSQueryRecord, SearchQuery } from 'app/interfaces';
import { LegendService } from 'app/shared/services/legend.service';

@Component({
    selector: 'app-search-collection-page',
    template: `
                <app-search-graph></app-search-graph>
                <app-search-list
                    *ngIf="legend"
                    [totalRecords]="totalRecords$ | async"
                    [nodes]="nodes$ | async"
                    [currentPage]="currentPage$ | async"
                    [currentLimit]="currentLimit$ | async"
                    [currentQuery]="currentQuery$ | async"
                    [legend]="legend"
                    (showMore)="showMore($event)"
                ></app-search-list>`,
})
export class SearchCollectionPageComponent implements OnInit, OnDestroy {
    nodes$: Observable<FTSQueryRecord[]>;
    totalRecords$: Observable<number>;
    currentPage$: Observable<number>;
    currentLimit$: Observable<number>;
    currentQuery$: Observable<string>;

    legend: Map<string, string>;

    constructor(
        private route: ActivatedRoute,
        private store: Store<State>,
        private legendService: LegendService,
    ) {
        this.currentLimit$ = store.pipe(select(SearchSelectors.selectSearchLimit));
        this.currentPage$ = store.pipe(select(SearchSelectors.selectSearchPage));
        this.currentQuery$ = store.pipe(select(SearchSelectors.selectSearchQuery));
        this.nodes$ = store.pipe(select(SearchSelectors.selectSearchRecords));
        this.totalRecords$ = store.pipe(select(SearchSelectors.selectSearchTotal));

        this.legend = new Map<string, string>();
    }

    ngOnInit() {
        this.legendService.getAnnotationLegend().subscribe(legend => {
            Object.keys(legend).forEach(label => {
                // Keys of the result dict are all lowercase, need to change the first character
                // to uppercase to match Neo4j labels
                const formattedLabel = label.slice(0, 1).toUpperCase() + label.slice(1);
                this.legend.set(formattedLabel, legend[label].color);
            });
        });

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

    ngOnDestroy() {
        this.store.dispatch(SearchActions.searchReset());
    }
}
