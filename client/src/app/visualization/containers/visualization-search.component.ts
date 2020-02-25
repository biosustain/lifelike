import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { SearchService } from '../services/search.service';
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

    @Output() selectedResult = new EventEmitter<GraphNode>();

    autocompleteResults: Array<FTSQueryRecord> = [];

    searchForm = new FormGroup({
        search: new FormControl(''),
    });

    constructor(private searchService: SearchService) {}

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
        this.searchService.fullTextSearch(query).subscribe(
            (r: FTSResult) => {
                this.autocompleteResults = r.nodes;
            },
            error => {
                // #TODO: Generic error handler
            }
        );
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
}
