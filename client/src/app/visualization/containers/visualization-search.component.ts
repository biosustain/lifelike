import { Component, EventEmitter, Output } from '@angular/core';
import { SearchService } from '../services/search.service';
import { FormControl } from '@angular/forms';
import { GraphNode, Neo4jResults } from 'app/interfaces';

@Component({
    selector: 'app-visualization-search',
    templateUrl: './visualization-search.component.html',
    styleUrls: ['./visualization-search.component.scss'],
})
export class VisualizationSearchComponent {

    @Output() selectedResult = new EventEmitter<GraphNode>();

    autocompleteResults: Array<GraphNode> = [];

    search = new FormControl('');

    constructor(private searchService: SearchService) {}

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

    resultSelection(result: GraphNode) {
        this.selectedResult.emit(result);
    }

    onInputChanges(query: string) {
        this.searchService.searchGraphDatabase(query).subscribe(
            (r: Neo4jResults) => {
                console.log(r.nodes);
                this.autocompleteResults = r.nodes;
            },
            error => {
                // #TODO: Generic error handler
            }
        );
    }
}
