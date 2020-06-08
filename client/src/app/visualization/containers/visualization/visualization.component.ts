import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material';
import { ActivatedRoute } from '@angular/router';

import { EMPTY as empty, Subject, merge, Subscription, of } from 'rxjs';
import { filter, take, switchMap, map, first } from 'rxjs/operators';

import { DataSet } from 'vis-network';

import { isArray, isNullOrUndefined } from 'util';

import {
    ExpandNodeResult,
    ExpandNodeRequest,
    GetEdgeSnippetsResult,
    GetClusterSnippetsResult,
    GraphNode,
    GraphRelationship,
    Neo4jResults,
    Neo4jGraphConfig,
    NewClusterSnippetsPageRequest,
    NewEdgeSnippetsPageRequest,
    VisNode,
    VisEdge,
} from 'app/interfaces';
import {
    NODE_EXPANSION_LIMIT,
    NODE_EXPANSION_CLUSTERING_RECOMMENDATION,
} from 'app/shared/constants';
import { AutoClusterDialogComponent } from 'app/visualization/components/auto-cluster-dialog/auto-cluster-dialog.component';
import {
    NoResultsFromExpandDialogComponent
} from 'app/visualization/components/no-results-from-expand-dialog/no-results-from-expand-dialog.component';

import { VisualizationService } from '../../services/visualization.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit, OnDestroy {

    // Shows/Hide the component
    hideDisplay = false;

    networkGraphData: Neo4jResults;
    networkGraphConfig: Neo4jGraphConfig;
    nodes: DataSet<VisNode | GraphNode>;
    edges: DataSet<VisEdge | GraphRelationship>;

    expandNodeResult: ExpandNodeResult;
    getEdgeSnippetsResult: GetEdgeSnippetsResult;
    getClusterSnippetsResult: GetClusterSnippetsResult;
    getSnippetsError: HttpErrorResponse;

    getEdgeSnippetsSubject: Subject<NewEdgeSnippetsPageRequest>;
    getClusterSnippetsSubject: Subject<NewClusterSnippetsPageRequest>;
    getSnippetsSubscription: Subscription;

    nodeSelectedSubject: Subject<boolean>;

    // TODO: Will we need to have a legend for each database? i.e. the literature
    // data, biocyc, etc...
    legend: Map<string, string[]>;

    dontShowDialogAgain = false;
    clusterExpandedNodes = false;

    autoClusterDialogRef: MatDialogRef<AutoClusterDialogComponent>;

    // TODO: Will we need to add more of these?
    LITERATURE_LABELS = ['disease', 'chemical', 'gene'];

    constructor(
        public dialog: MatDialog,
        private route: ActivatedRoute,
        private visService: VisualizationService,
    ) {
        this.legend = new Map<string, string[]>();

        this.getClusterSnippetsSubject = new Subject<NewClusterSnippetsPageRequest>();
        this.getEdgeSnippetsSubject = new Subject<NewEdgeSnippetsPageRequest>();
        this.nodeSelectedSubject = new Subject<boolean>();

        // We don't want to kill the subscription if an error is returned! This is the default behavior for
        // subscriptions.
        this.getSnippetsSubscription = merge(
            // Merge the streams, so we can cancel one if the other emits; We always take the most recent
            // emission betweent the streams.
            this.getClusterSnippetsSubject,
            this.getEdgeSnippetsSubject,
            this.nodeSelectedSubject,
        ).pipe(
            switchMap((request: NewClusterSnippetsPageRequest | NewEdgeSnippetsPageRequest | boolean) => {
                if (typeof request === 'boolean') {
                    // We don't currently need to do anything if the request was for node data
                    return of(request);
                } else if (isArray(request.queryData)) {
                    // If queryData is an array then we are getting snippets for a cluster
                    return this.visService.getSnippetsForCluster(request as NewClusterSnippetsPageRequest);
                } else {
                    return this.visService.getSnippetsForEdge(request as NewEdgeSnippetsPageRequest);
                }
            }),
        ).subscribe(
            // resp might be any of GetClusterSnippetsResult | GetEdgeSnippetsResult | boolean | HttpErrorResponse
            (resp: any) => {
                if (typeof resp === 'boolean') {
                    // We don't currently need to do anything if the request was for node data
                    return;
                } else if (!isNullOrUndefined(resp.error)) {
                    // Response was an error
                    this.getSnippetsError = resp;
                    this.getClusterSnippetsResult = null;
                    this.getEdgeSnippetsResult = null;
                } else if (isArray(resp.snippetData)) {
                    // If snippetData is an array then we are getting snippets for a cluster
                    this.getClusterSnippetsResult = resp as GetClusterSnippetsResult;
                    this.getSnippetsError = null;
                } else {
                    this.getEdgeSnippetsResult = resp as GetEdgeSnippetsResult;
                    this.getSnippetsError = null;
                }
            },
        );
    }

    ngOnInit() {
        this.visService.getLegendForVisualizer().subscribe(legend => {
            Object.keys(legend).forEach(label => {
                if (this.LITERATURE_LABELS.includes(label)) {
                    // Keys of the result dict are all lowercase, need to change the first character
                    // to uppercase to match Neo4j labels
                    const formattedLabel = label.slice(0, 1).toUpperCase() + label.slice(1);
                    this.legend.set(formattedLabel, [legend[label].color, '#3797DB']);
                }
            });
        });

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

        this.getClusterSnippetsResult = null;
        this.getEdgeSnippetsResult = null;

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
                    avoidOverlap: 0.2,
                    centralGravity: 0.1,
                    damping: 0.9,
                    gravitationalConstant: -10000,
                    springLength: 250,
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

    ngOnDestroy() {
        this.getClusterSnippetsSubject.complete();
        this.getEdgeSnippetsSubject.complete();
        this.getSnippetsSubscription.unsubscribe();
    }

    openAutoClusterDialog(expandResult: ExpandNodeResult): void {
        this.autoClusterDialogRef = this.dialog.open(AutoClusterDialogComponent, {
            disableClose: true,
            width: '600px', height: '330px',
            data: {...expandResult},
        });
        const dialogInstance = this.autoClusterDialogRef.componentInstance;

        // Once the user clicks an action on the dialog, either pre-cluster the results or expand normally
        this.autoClusterDialogRef.componentInstance.clickedActionButton.pipe(
            first(),
        ).subscribe((clickedOkButton) => {
            this.nodes.update(dialogInstance.data.nodes);
            this.edges.update(dialogInstance.data.edges);

            this.dontShowDialogAgain = dialogInstance.dontAskAgain;
            this.clusterExpandedNodes = clickedOkButton;

            // If the 'Yes' button was clicked, we update the dialog size and show a loading indicator while clustering is happening
            if (clickedOkButton) {
                this.autoClusterDialogRef.updateSize('200px', '100px');
                this.expandNodeResult = dialogInstance.data;
            } else {
                // Otherwise we just close the dialog
                this.autoClusterDialogRef.close();
            }
        });
    }

    openAutoClusterLoadingDialog() {
        this.autoClusterDialogRef = this.dialog.open(AutoClusterDialogComponent, {
            disableClose: true,
            width: '200px', height: '100px',
        });
        const dialogInstance = this.autoClusterDialogRef.componentInstance;

        dialogInstance.loadingClusters = true;
    }

    openNoResultsFromExpandDialog() {
        this.dialog.open(NoResultsFromExpandDialogComponent, {
            width: '250px',
            height: '120px',
        });
    }

    finishedPreClustering(event: boolean) {
        this.autoClusterDialogRef.close();
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
            font: {
                color: this.legend.get(n.label)[0],
            },
            color: {
                background: '#FFFFFF',
                border: this.legend.get(n.label)[1],
                hover: {
                    background: '#FFFFFF',
                    border: this.legend.get(n.label)[1],
                },
                highlight: {
                    background: '#FFFFFF',
                    border: this.legend.get(n.label)[1],
                }
            },
            label: n.displayName.length > 64 ? n.displayName.slice(0, 64) + '...'  : n.displayName,
        };
    }

    convertEdgeToVisJSFormat(e: GraphRelationship) {
        return {
            ...e,
            color: {
                color: '#3797DB',
            },
            label: e.data.description,
            arrows: 'to'
        };
    }

    expandNode(expandNodeRequest: ExpandNodeRequest) {
        const {nodeId, filterLabels } = expandNodeRequest;

        if (filterLabels.length === 0) {
            this.openNoResultsFromExpandDialog();
            return;
        }

        this.visService.expandNode(nodeId, filterLabels, NODE_EXPANSION_LIMIT).subscribe((r: Neo4jResults) => {
            const nodeRef = this.nodes.get(nodeId) as VisNode;
            const visJSDataFormat = this.convertToVisJSFormat(r);
            let { nodes } = visJSDataFormat;
            const { edges } = visJSDataFormat;

            // If the expanded node has no connecting relationships, notify the user
            if (edges.length === 0) {
                this.openNoResultsFromExpandDialog();
                return;
            }

            // Sets the node expand state to true
            nodes = nodes.map((n) => {
                if (n.id === nodeId) {
                    return {...n, expanded: !nodeRef.expanded};
                }
                return n;
            });

            // If the user didn't manually disable the dialog, or if the expanded node has more relationships than the
            // recommendation, re-open the dialog
            if (!this.dontShowDialogAgain || edges.length > NODE_EXPANSION_CLUSTERING_RECOMMENDATION) {
                this.openAutoClusterDialog({ nodes, edges, expandedNode: nodeId } as ExpandNodeResult);
            } else {
                this.nodes.update(nodes);
                this.edges.update(edges);

                // Otherwise, do what the user originally chose
                if (this.clusterExpandedNodes) {
                    // Manully re-open the loading dialog if the user chose to auto-cluster
                    this.openAutoClusterLoadingDialog();
                    this.expandNodeResult = { nodes, edges, expandedNode: nodeId } as ExpandNodeResult;
                }
            }
        });
    }

    getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
        this.getEdgeSnippetsSubject.next(request);
    }

    // TODO: There is a bug here: If the user opens a cluster after clicking it
    // but before the cluster graph data response is received, then the sidenav
    // will error because the returned duplicate node ids will not exist on the
    // graph anymore. This can be fixed by creating some kind of interrupt event
    // on this subscription. Could use rxjs 'race' + an output from the child here.
    getSnippetsForCluster(request: NewClusterSnippetsPageRequest) {
        this.getClusterSnippetsSubject.next(request);
    }

    nodeSelectedCallback() {
        this.nodeSelectedSubject.next(true);
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
}
