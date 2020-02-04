import { Component, OnInit } from '@angular/core';

import { DataSet } from 'vis-network';

import { VisualizationService } from '../services/visualization.service';
import {
    Neo4jResults,
    Neo4jGraphConfig,
    VisNode,
    VisEdge,
} from 'app/interfaces';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    networkGraphData: Neo4jResults;
    networkGraphConfig: Neo4jGraphConfig;
    nodes: DataSet<VisNode>;
    edges: DataSet<VisEdge>;
    // TODO KG-17: Add a 'clusters' object?

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        this.visService.getSomeDiseases().subscribe((results: Neo4jResults) => {
            this.networkGraphData = this.setupInitialProperties(results);
            this.nodes = new DataSet(this.networkGraphData.nodes);
            this.edges = new DataSet(this.networkGraphData.edges);
        });

        this.networkGraphConfig = {
            interaction: {
                hover: true,
                navigationButtons: true,
                multiselect: true,
                selectConnectedEdges: false,
            },
            physics: {
                enabled: true,
                barnesHut: {
                    springConstant: 0.04,
                    damping: 0.9,
                    gravitationalConstant: -10000,
                }
            },
            nodes: {
                size: 25,
                shape: 'dot',
            },
        };
    }

    /**
     * Used for adding properties custom properties on initial setup.
     * Is different from convertToVisJSFormat which is a reusable utility
     * function to rearrange custom properties.
     * @param result - neo4j results from AP call
     */
    setupInitialProperties(result: Neo4jResults): Neo4jResults {
        // Sets the node expand state to initially be false
        // Used for collapse/expand
        const setExpandProperty = result.nodes.map((n) => {
            return {...n, expanded: false};
        });
        return this.convertToVisJSFormat({nodes: setExpandProperty, edges: result.edges});
    }

    /**
     * This function is used to modify the API response to a format
     * vis.js will understand. vis.js uses a limited set
     * of properties for rendering the network graph.
     * @param result - a list of nodes and edges for conversion
     */
    convertToVisJSFormat(results: Neo4jResults): Neo4jResults {
        let { nodes, edges } = results;
        nodes = nodes.map((n) => {
            return {
                ...n,
                primaryLabel: n.label,
                label: n.displayName,
            };
        });
        edges = edges.map((e) => {
            return {...e, arrows: 'to'};
        });
        return {nodes, edges};
    }

    expandNode(nodeId: number) {
        this.visService.expandNode(nodeId).subscribe((r: Neo4jResults) => {
            const nodeRef: VisNode = this.nodes.get(nodeId);
            const visJSDataFormat = this.convertToVisJSFormat(r);
            const { edges } = visJSDataFormat;
            let { nodes } = visJSDataFormat;
            // Sets the node expand state to true
            nodes = nodes.map((n) => {
                if (n.id === nodeId) {
                    return {...n, expanded: !nodeRef.expanded};
                }
                return n;
            });
            this.nodes.update(nodes);
            this.edges.update(edges);
        });
    }
}
