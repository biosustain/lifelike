import { Component, OnInit, ViewChild } from '@angular/core';
import { VisualizationService } from '../services/visualization.service';
import { Neo4jResults, Neo4jGraphConfig } from '../../interfaces';
import { Network, DataSet } from 'vis-network';
import { VisualizationCanvasComponent } from '../components/visualization-canvas.component';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    networkGraphData: Neo4jResults;
    networkGraphConfig: Neo4jGraphConfig;
    nodes: DataSet<any, any>;
    edges: DataSet<any, any>;

    @ViewChild(VisualizationCanvasComponent, {static: false}) canvas: VisualizationCanvasComponent;

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        this.visService.getAllOrganisms().subscribe((results: Neo4jResults) => {
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
    setupInitialProperties(result: Neo4jResults) {
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
            },
            physics: {
                enabled: true,
            },
            nodes: {
                size: 25,
                shape: 'dot',
            }
        };
        return config;
    }

    /**
     * A helper method to clean up all nodes related
     * to the edges in question.
     * @param edgeIds - array of edge ids to remove
     */
    collapseAllChildren(edgeIds: Array<number>) {
        if (edgeIds.length === 0) {
            return;
        } else {
            const nodesToRemove = edgeIds.map((eid) => {
                const edge = this.edges.get(eid);
                const node = edge.from;
                this.edges.remove(eid);
                return node;
            });
            nodesToRemove.map((nid) => {
                const edges = this.canvas.networkGraph.getConnectedEdges(nid) as Array<number>;
                this.nodes.remove(nid);
                this.collapseAllChildren(edges);
            });
        }
    }

    expandAndCollapseNode(results: {nodeId: number, edgeIds: Array<number>}) {
        const { nodeId, edgeIds } = results;
        const nodeRef = this.nodes.get(nodeId);

        if (nodeRef.expanded) {
            const edgeIdsFiltered = edgeIds.filter((eid) => {
                const edge = this.edges.get(eid);
                return edge.to === nodeId;
            });
            this.collapseAllChildren(edgeIdsFiltered );
            const updatedNodeState = {...nodeRef, expanded: !nodeRef.expanded};
            this.nodes.update(updatedNodeState);
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
