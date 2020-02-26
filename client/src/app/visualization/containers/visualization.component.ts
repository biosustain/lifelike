import { Component, OnInit } from '@angular/core';

import { DataSet } from 'vis-network';

import {
    ClusteredNode,
    GetClusterGraphDataResult,
    GetSnippetsResult,
    GraphNode,
    GraphRelationship,
    Neo4jResults,
    Neo4jGraphConfig,
    VisNode,
    VisEdge,
} from 'app/interfaces';
import { NODE_EXPANSION_LIMIT } from 'app/shared/constants';

import { VisualizationService } from '../services/visualization.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {
    networkGraphData: Neo4jResults;
    networkGraphConfig: Neo4jGraphConfig;
    getSnippetsResult: GetSnippetsResult;
    getClusterGraphDataResult: GetClusterGraphDataResult;
    nodes: DataSet<VisNode | GraphNode>;
    edges: DataSet<VisEdge | GraphNode>;

    legend: Map<string, string[]>;

    constructor(private visService: VisualizationService) {
        this.legend = new Map<string, string[]>();
        this.legend.set('Gene', ['#78CDD7', '#247B7B']);
        this.legend.set('Disease', ['#8FA6CB', '#7D84B2']);
        this.legend.set('Chemical', ['#CD5D67', '#410B13']);
    }

    ngOnInit() {
        this.visService.getSomeDiseases().subscribe((results: Neo4jResults) => {
            this.networkGraphData = this.setupInitialProperties(results);
            this.nodes = new DataSet(this.networkGraphData.nodes);
            this.edges = new DataSet(this.networkGraphData.edges);
        });

        this.getSnippetsResult = null;

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
            edges: {
                font: {
                    size: 12
                },
                widthConstraint: {
                    maximum: 90
                },
            },
            nodes: {
                size: 25,
                shape: 'box',
                // TODO: Investigate the 'scaling' property for dynamic resizing of 'box' shape nodes
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
        nodes = nodes.map((n: GraphNode) => this.convertNodeToVisJSFomart(n));
        edges = edges.map((e: GraphRelationship) => this.convertEdgeToVisJSFormat(e));
        return {nodes, edges};
    }

    convertNodeToVisJSFomart(n: GraphNode) {
        return {
            ...n,
            primaryLabel: n.label,
            color: {
                background: this.legend.get(n.label)[0],
                border: this.legend.get(n.label)[1],
                hover: {
                    background: this.legend.get(n.label)[0],
                    border: this.legend.get(n.label)[1],
                },
                highlight: {
                    background: this.legend.get(n.label)[0],
                    border: this.legend.get(n.label)[1],
                }
            },
            label: n.displayName.length > 64 ? n.displayName.slice(0, 64) + '...'  : n.displayName,
        };
    }

    convertEdgeToVisJSFormat(e: GraphRelationship) {
        return {...e, label: e.data.description, arrows: 'to'};
    }

    expandNode(nodeId: number) {
        this.visService.expandNode(nodeId, NODE_EXPANSION_LIMIT).subscribe((r: Neo4jResults) => {
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

    getSnippetsFromEdge(edge: VisEdge) {
        this.visService.getSnippetsFromEdge(edge).subscribe((result) => {
            this.getSnippetsResult = result;
        });
    }

    getClusterGraphData(clusteredNodes: ClusteredNode[]) {
        this.visService.getClusterGraphData(clusteredNodes).subscribe((result) => {
            this.getClusterGraphDataResult = result;
        });
    }

    updateCanvasWithSingleNode(data: GraphNode) {
        this.nodes.clear();
        this.edges.clear();
        const node = this.convertNodeToVisJSFomart(data);
        this.nodes.add(node);
    }
}
