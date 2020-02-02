import { Component, OnInit, ViewChild } from '@angular/core';

import { DataSet, IdType } from 'vis-network';

import { VisualizationService } from '../services/visualization.service';
import {
    Neo4jResults,
    Neo4jGraphConfig,
    VisNode,
    VisEdge,
} from '../../interfaces';
import { VisualizationCanvasComponent } from '../components/visualization-canvas/visualization-canvas.component';

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

    @ViewChild(VisualizationCanvasComponent, {static: false}) canvas: VisualizationCanvasComponent;

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        this.visService.getSomeDiseases().subscribe((results: Neo4jResults) => {
            this.networkGraphData = this.setupInitialProperties(results);
            this.nodes = new DataSet(this.networkGraphData.nodes);
            this.edges = new DataSet(this.networkGraphData.edges);
        });
        this.networkGraphConfig = this.visualizationConfig();
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

    /**
     * A configuration from vis.js
     * See the API for more information.
     */
    visualizationConfig(): Neo4jGraphConfig {
        const config = {
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
        return config;
    }

    collapseNeighbors(rootNode: VisNode) {
        // Get all the nodes connected to the root node, before removing edges
        const connectedNodes = this.canvas.networkGraph.getConnectedNodes(rootNode.id) as IdType[];
        (this.canvas.networkGraph.getConnectedEdges(rootNode.id) as IdType[]).forEach(
            connectedEdge => {
                this.edges.remove(connectedEdge);
            }
        );

        // If a previously connected node has no remaining edges (i.e. it is not connected
        // to any other neighbor), remove it.
        connectedNodes.forEach((connectedNodeId: number) => {
            const connectedEdges = this.canvas.networkGraph.getConnectedEdges(connectedNodeId);
            if (connectedEdges.length == 0) {
                this.nodes.remove(connectedNodeId);
            }
        });
    }

    expandAndCollapseNode(results: {nodeId: number, edgeIds: Array<number>}) {
        const { nodeId, edgeIds } = results;
        const nodeRef: VisNode = this.nodes.get(nodeId);

        if (nodeRef.expanded) {
            // Updates node expand state
            const updatedNodeState = {...nodeRef, expanded: !nodeRef.expanded};
            this.nodes.update(updatedNodeState);
            // 'Collapse' all neighbor nodes that do not themselves have neighbors
            this.collapseNeighbors(nodeRef);
        } else {
            this.visService.expandNode(nodeId).subscribe((r: Neo4jResults) => {
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
}
