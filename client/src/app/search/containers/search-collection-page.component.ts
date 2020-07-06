import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { filter, tap} from 'rxjs/operators';

import { FTSQueryRecord, SearchQuery } from 'app/interfaces';
import { VIZ_SEARCH_LIMIT } from 'app/shared/constants';
import { LegendService } from 'app/shared/services/legend.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { SearchService } from '../services/search.service';

@Component({
    selector: 'app-search-collection-page',
    templateUrl: './search-collection-page.component.html',
    styleUrls: ['./search-collection-page.component.scss']
})
export class SearchCollectionPageComponent implements OnInit, OnDestroy {
    records: FTSQueryRecord[];
    totalRecords: number;
    currentPage: number;
    currentLimit: number;
    currentQuery: string;

    legend: Map<string, string>;

    routerParamSub: Subscription;

    constructor(
        private route: ActivatedRoute,
        private searchService: SearchService,
        private legendService: LegendService,
        private workspaceManager: WorkspaceManager,
    ) {
        this.records = [];
        this.totalRecords = 0;
        this.currentPage = 1;
        this.currentLimit = VIZ_SEARCH_LIMIT;
        this.currentQuery = '';

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

        // Whenever the router params change, re-run search with the new query params.
        this.routerParamSub = this.route.queryParams.pipe(
            filter(params => params.q),
            tap((params) => {
                this.searchService.visualizerSearchTemp(params.q, 1, VIZ_SEARCH_LIMIT, 'n:db_Literature').subscribe(result => {
                    const { query, nodes, total, page, limit } = result;

                    this.records = nodes;
                    this.totalRecords = total;
                    this.currentQuery = query;
                    this.currentPage = page;
                    this.currentLimit = limit;
                });
            }),
        ).subscribe();
    }

    ngOnDestroy() {
        this.routerParamSub.unsubscribe();
    }

    /**
     * Retrieves the next page of search results for the current term, and appends the new results
     * to the current list. Also updates the total number of records and current query params.
     * @param searchQuery object representing the current term, search limit and page
     */
    showMore(searchQuery: SearchQuery) {
        const {query, page, limit} = searchQuery;
        this.searchService.visualizerSearchTemp(query, page, limit, 'n:db_Literature').subscribe(result => {
            const { nodes, total } = result;

            this.records = this.records.concat(nodes);
            this.totalRecords = total;
            this.currentQuery = query;
            this.currentPage = page;
            this.currentLimit = limit;
        });
    }

    /**
     * Redirects to the visualizer search page with the new query term as a URL parameter.
     * @param query string to search for
     */
    search(query: string) {
        this.workspaceManager.navigateByUrl(`kg-visualizer/search?q=${query}`);
    }
}
