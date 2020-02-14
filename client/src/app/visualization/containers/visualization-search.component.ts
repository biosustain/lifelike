import { Component, EventEmitter, Output } from '@angular/core';
import { VisualizationService } from '../services/visualization.service';
import { FormControl } from '@angular/forms';
import { FTSearchResult, FTSNodeScore, GraphNode } from 'app/interfaces';

@Component({
    selector: 'app-visualization-search',
    templateUrl: './visualization-search.component.html',
    styleUrls: ['./visualization-search.component.scss'],
})
export class VisualizationSearchComponent {

    @Output() selectedResult = new EventEmitter<FTSNodeScore>();

    autocompleteResults: Array<FTSNodeScore> = [];

    search = new FormControl('');

    constructor(private visService: VisualizationService) {}

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

    displayFn(n: FTSNodeScore) {
        return n ? n.node.displayName : undefined;
    }

    /**
     * Used for displaying a node's data property
     * in a string form.
     * @param n - a graph node
     */
    stringifyData(n: GraphNode) {
        const nodeToString = [];
        for (const [key, value] of Object.entries(n.data)) {
            nodeToString.push(`${key}: ${value}`);
        }
        return nodeToString.join(', ');
    }

    resultSelection(result: FTSNodeScore) {
        this.selectedResult.emit(result);
    }

    onInputChanges(query: string) {
        this.visService.searchGraphDatabase(query).subscribe(
            (r: FTSearchResult) => {
                this.autocompleteResults = r.nodes;
            },
            error => {
                // #TODO: Generic error handler
            }
        );
    }
}
