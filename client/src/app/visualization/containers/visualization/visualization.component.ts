import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { EMPTY as empty } from 'rxjs';
import { filter, take, switchMap, map } from 'rxjs/operators';

import { DataSet } from 'vis-network';

import {
    ClusteredNode,
    DuplicateVisEdge,
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

import { VisualizationService } from '../../services/visualization.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    // Shows/Hide the component
    hideDisplay = false;

    networkGraphData: Neo4jResults;
    networkGraphConfig: Neo4jGraphConfig;
    getSnippetsResult: GetSnippetsResult;
    getClusterGraphDataResult: GetClusterGraphDataResult;
    nodes: DataSet<VisNode | GraphNode>;
    edges: DataSet<VisEdge | GraphNode>;
    duplicatedEdges = new Set<number>();

    legend: Map<string, string[]>;

    constructor(
        private route: ActivatedRoute,
        private visService: VisualizationService,
    ) {
        this.legend = new Map<string, string[]>();
        this.legend.set('Gene', ['#78CDD7', '#247B7B']);
        this.legend.set('Disease', ['#8FA6CB', '#7D84B2']);
        this.legend.set('Chemical', ['#CD5D67', '#410B13']);
    }

    ngOnInit() {
        this.route.queryParams.pipe(
            filter(params => params.data),
            switchMap((params) => {
                if (!params.data) {
                    return empty;
                }
                return this.visService.getBatch(params.data).pipe(
                    map((result: Neo4jResults) => result)
                );
            }),
            take(1),
        ).subscribe((result) => {
            if (result) {
                this.networkGraphData = this.setupInitialProperties(result);
                this.nodes = new DataSet(this.networkGraphData.nodes);
                this.edges = new DataSet(this.networkGraphData.edges);
            }
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
        nodes = nodes.map((n: GraphNode) => this.convertNodeToVisJSFormat(n));
        edges = edges.map((e: GraphRelationship) => this.convertEdgeToVisJSFormat(e));
        return {nodes, edges};
    }

    convertNodeToVisJSFormat(n: GraphNode) {
        return {
            ...n,
            expanded: false,
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
            const nodeRef = this.nodes.get(nodeId) as VisNode;
            const visJSDataFormat = this.convertToVisJSFormat(r);
            let { edges, nodes } = visJSDataFormat;

            // Sets the node expand state to true
            nodes = nodes.map((n) => {
                if (n.id === nodeId) {
                    return {...n, expanded: !nodeRef.expanded};
                }
                return n;
            });

            this.nodes.update(nodes);

            edges = edges.filter(candidateEdge => !this.duplicatedEdges.has(candidateEdge.id));
            this.edges.update(edges);
        });
    }

    getSnippetsFromEdge(edge: VisEdge) {
        this.visService.getSnippetsFromEdge(edge).subscribe((result) => {
            this.getSnippetsResult = result;
        });
    }

    getSnippetsFromDuplicateEdge(edge: DuplicateVisEdge) {
        this.visService.getSnippetsFromDuplicateEdge(edge).subscribe((result) => {
            this.getSnippetsResult = result;
        });
    }

    // TODO: There is a bug here: If the user opens a cluster after clicking it
    // but before the cluster graph data response is received, then the sidenav
    // will error because the returned duplicate node ids will not exist on the
    // graph anymore. This can be fixed by creating some kind of interrupt event
    // on this subscription. Could use rxjs 'race' + an output from the child here.
    getClusterGraphData(clusteredNodes: ClusteredNode[]) {
        this.visService.getClusterGraphData(clusteredNodes).subscribe((result) => {
            this.getClusterGraphDataResult = result;
        });
    }

    updateCanvasWithSingleNode(data: GraphNode) {
        this.nodes.clear();
        this.edges.clear();
        const node = this.convertNodeToVisJSFormat(data);
        this.nodes.add(node);
    }

    hideCanvas(state: boolean) {
        this.hideDisplay = state;
    }

    addDuplicatedEdge(edge: number) {
        this.duplicatedEdges.add(edge);
    }

    removeDuplicatedEdge(edge: number) {
        this.duplicatedEdges.delete(edge);
    }
}
