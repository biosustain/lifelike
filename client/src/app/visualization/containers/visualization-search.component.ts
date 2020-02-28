import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { GraphNode, FTSResult, FTSQueryRecord } from 'app/interfaces';
import { MatAutocompleteTrigger } from '@angular/material';

@Component({
    selector: 'app-visualization-search',
    templateUrl: './visualization-search.component.html',
    styleUrls: ['./visualization-search.component.scss'],
})
export class VisualizationSearchComponent implements OnInit {

    @ViewChild('autoCompleteSearch', {read: MatAutocompleteTrigger, static: true})
    autoCompleteSearch: MatAutocompleteTrigger;

    // Alerts that a search has been invoked
    @Output() searchSubmitted = new EventEmitter<boolean>();
    // Alerts a result has been selected from an autocomplete
    @Output() selectedResult = new EventEmitter<GraphNode>();
    // Alerts a navigation has been clicked
    @Output() navigateBack = new EventEmitter<boolean>();


    searchResults: FTSResult;
    searchResultRecords: Array<FTSQueryRecord>;

    searchForm = new FormGroup({
        search: new FormControl(''),
    });

    // Shows/Hides 'show more' button
    showMoreVisible = false;
    // Total Results
    totalResults = 0;
    // Search Query
    searchQuery: string;

    constructor() {}

    ngOnInit() {
        // TODO: Re-enable once we have a proper predictive/autocomplete implemented
        this.autoCompleteSearch.autocompleteDisabled = true;
    }

    getStyling(label: string) {
        switch (label) {
            case 'Disease': {
                return 'vis-search-result-disease';
            }
            case 'Gene': {
                return 'vis-search-result-gene';
            }
            case 'Taxonomy': {
                return 'vis-search-result-taxonomy';
            }
            case 'Chemical': {
                return 'vis-search-result-chemical';
            }
            default:
                return 'vis-search-result';
        }
    }

    displayFn(n: GraphNode) {
        return n ? n.displayName : undefined;
    }

    resultSelection(result: GraphNode) {
        this.selectedResult.emit(result);
    }

    onSubmit() {
        const query = this.searchForm.value.search;
        // this.searchService.fullTextSearch(query).subscribe(
        //     (r: FTSResult) => {
        //         this.searchSubmitted.emit(true);
        //         const { page, limit, total, nodes } = r;
        //         this.totalResults = total;
        //         this.searchQuery = query;
        //         this.searchResults = r;
        //         this.searchResultRecords = nodes;
        //         if ((page * limit) < total) {
        //             this.showMoreVisible = true;
        //         } else {
        //             this.showMoreVisible = false;
        //         }
        //     },
        //     error => {
        //         // #TODO: Generic error handler
        //     }
        // );
    }

    onInputChanges(query: string) {
        // TODO: Re-enable once we have a proper predictive/autocomplete implemented
        // this.searchService.predictiveSearch(query).subscribe(
        //     (r: Neo4jResults) => {
        //         this.autocompleteResults = r.nodes;
        //     },
        //     error => {
        //         // #TODO: Generic error handler
        //     }
        // );
    }

    showMore() {
        // const { query, page, limit, total } = this.searchResults;
        // if (this.searchResultRecords.length <= total) {
        //     this.searchService.fullTextSearch(query, page + 1, limit).subscribe(
        //         (r: FTSResult) => {
        //             this.searchResults = r;
        //             this.searchResultRecords = [
        //                 ...this.searchResultRecords, ...r.nodes];
        //             if ((total - this.searchResultRecords.length) === 0) {
        //                 this.showMoreVisible = false;
        //             }
        //         }
        //     );
        // }
    }

    navigateToVisualizer() {
        this.navigateBack.emit(false);
    }
}
