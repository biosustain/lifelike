import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { Options } from '@popperjs/core';

import { Subject } from 'rxjs';
import { skip, first } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { Network, DataSet, IdType } from 'vis-network';

import { MAX_CLUSTER_ROWS } from 'app/constants';
import {
    ClusterData,
    ClusteredNode,
    DuplicateNodeEdgePair,
    Direction,
    DuplicateVisEdge,
    DuplicateVisNode,
    ExpandNodeResult,
    ExpandNodeRequest,
    GetClusterDataResult,
    GetSnippetsResult,
    GroupRequest,
    Neo4jGraphConfig,
    ReferenceTableRow,
    SidenavClusterEntity,
    SidenavEdgeEntity,
    SidenavNodeEntity,
    SidenavSnippetData,
    VisEdge,
    VisNode,
} from 'app/interfaces';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { uuidv4 } from 'app/shared/utils';
import { ContextMenuControlService } from 'app/visualization/services/context-menu-control.service';
import { VisualizationService } from 'app/visualization/services/visualization.service';

enum SidenavEntityType {
    EMPTY,
    NODE,
    EDGE,
    CLUSTER,
}

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
    providers: [ContextMenuControlService],
})
export class VisualizationCanvasComponent implements OnInit {
    @Output() expandNode = new EventEmitter<ExpandNodeRequest>();
    @Output() finishedPreClustering = new EventEmitter<boolean>();
    @Output() getSnippetsFromEdge = new EventEmitter<VisEdge>();
    @Output() getSnippetsFromDuplicateEdge = new EventEmitter<DuplicateVisEdge>();
    @Output() getClusterData = new EventEmitter<ClusteredNode[]>();
    @Output() addDuplicatedEdge = new EventEmitter<number>();
    @Output() removeDuplicatedEdge = new EventEmitter<number>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    @Input() set expandNodeResult(result: ExpandNodeResult) {
        if (!isNullOrUndefined(result)) {
            const edgeLabelsOfExpandedNode = this.getConnectedEdgeLabels(result.expandedNode);
            let newClusterCount = 0;
            edgeLabelsOfExpandedNode.forEach(directionList => newClusterCount += directionList.length);

            if (edgeLabelsOfExpandedNode.size === 0) {
                this.messageDialog.display(
                    {
                        title: 'Auto-Cluster Error!',
                        message: 'Something strange occurred: attempted to pre-cluster a node with zero relationships!',
                        type: MessageType.Error
                    }
                );
                return;
            }

            // When the last relationship is finished clustering, emit
            this.clusterCreatedSource.asObservable().pipe(
                skip(this.openClusteringRequests + newClusterCount - 1),
                first(),
            ).subscribe(() => {
                this.finishedPreClustering.emit(true);
            });

            edgeLabelsOfExpandedNode.forEach((directionList, relationship) => {
                directionList.forEach(direction => {
                    const neighborNodesWithRel = this.getNeighborsWithRelationship(relationship, result.expandedNode, direction);
                    const duplicateNodeEdgePairs = this.createDuplicateNodesAndEdges(
                        neighborNodesWithRel, relationship, result.expandedNode, direction
                    );

                    // This is very similar to the implementation of `updateGraphWithDuplicates`, except that here we only delete
                    // the existing nodes/edges, and don't add the duplicates. We will add the duplicates later, in `createCluster`
                    const nodesToRemove = [];
                    const edgesToRemove = [];

                    duplicateNodeEdgePairs.forEach(pair => {
                        const duplicateNode = pair.node;
                        const duplicateEdge = pair.edge;
                        const edges = this.networkGraph.getConnectedEdges(duplicateNode.duplicateOf);

                        if (edges.length === 1) {
                            // If the original node is being clustered on its last unclustered edge,
                            // remove it entirely from the canvas.
                            nodesToRemove.push(duplicateNode.duplicateOf);
                        }

                        this.addDuplicatedEdge.emit(duplicateEdge.duplicateOf as number);
                        edgesToRemove.push(duplicateEdge.duplicateOf);
                    });

                    this.edges.remove(edgesToRemove);
                    this.nodes.remove(nodesToRemove);

                    this.createCluster(result.expandedNode, relationship, duplicateNodeEdgePairs);
                });
            });
        }
    }
    @Input() set getSnippetsResult(result: GetSnippetsResult) {
        if (!isNullOrUndefined(result)) {
            this.sidenavEntityType = SidenavEntityType.EDGE;
            this.sidenavEntity = {
                data: {
                    to: this.nodes.get(result.toNodeId) as VisNode,
                    from: this.nodes.get(result.fromNodeId) as VisNode,
                    association: result.association,
                    snippets: result.snippets,
                } as SidenavSnippetData
            } as SidenavEdgeEntity;
        }
    }
    @Input() set getClusterDataResult(result: GetClusterDataResult) {
        if (!isNullOrUndefined(result)) {
            this.sidenavEntityType = SidenavEntityType.CLUSTER;
            const data = result.snippetData.results.map(snippetResult => {
                return {
                    to: this.nodes.get(snippetResult.toNodeId) as VisNode,
                    from: this.nodes.get(snippetResult.fromNodeId) as VisNode,
                    association: snippetResult.association,
                    snippets: snippetResult.snippets,
                } as SidenavSnippetData;
            });
            this.sidenavEntity = { data } as SidenavClusterEntity;
        }
    }
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;
    @Input() legend: Map<string, string[]>;

    // Need to create a reference to the enum so we can use it in the template
    sidenavEntityTypeEnum = SidenavEntityType;

    sidenavOpened: boolean;
    sidenavEntity: SidenavNodeEntity | SidenavEdgeEntity | SidenavClusterEntity;
    sidenavEntityType: SidenavEntityType;

    networkGraph: Network;
    selectedNodes: IdType[];
    selectedNodeEdgeLabelData: Map<string, Direction[]>;
    selectedEdges: IdType[];
    referenceTableData: DuplicateNodeEdgePair[];
    clusters: Map<string, ClusterData>;
    openClusteringRequests: number;
    selectedClusterNodeData: VisNode[];

    clusterCreatedSource: Subject<boolean>;

    contextMenuTooltipSelector: string;
    contextMenuTooltipOptions: Partial<Options>;
    referenceTableTooltipSelector: string;
    referenceTableTooltipOptions: Partial<Options>;

    expandNodeForm: FormGroup;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
        private messageDialog: MessageDialog,
        private visService: VisualizationService,
        private fb: FormBuilder,
    ) {
        this.sidenavOpened = false;
        this.sidenavEntity = null;
        this.sidenavEntityType = SidenavEntityType.EMPTY;

        this.selectedNodes = [];
        this.selectedEdges = [];
        this.selectedNodeEdgeLabelData = new Map<string, Direction[]>();
        this.referenceTableData = [];

        this.contextMenuTooltipSelector = '#***ARANGO_USERNAME***-menu';
        this.contextMenuTooltipOptions = {
            placement: 'right-start',
        };

        this.referenceTableTooltipSelector = '#***ARANGO_USERNAME***-table';
        this.referenceTableTooltipOptions = {
            placement: 'right-start',
        };

        this.clusters = new Map<string, ClusterData>();
        this.openClusteringRequests = 0;
        this.clusterCreatedSource = new Subject<boolean>();
        this.selectedClusterNodeData = [];

        this.expandNodeForm = this.fb.group({
            Chemical: true,
            Disease: true,
            Gene: true,
        });
    }

    ngOnInit() {
        const container = document.getElementById('network-viz');
        const data = {
            nodes: this.nodes,
            edges: this.edges,
        };
        this.networkGraph = new Network(container, data, this.config);
        this.visualizerSetupEventBinds();
    }

    /**
     * Turns the physics (animation) on/off depending on the status
     * @param animationOn - boolean to turn on/off the physics animation
     */
    toggleAnimation(animationOn: boolean) {
        this.networkGraph.setOptions({physics: animationOn});
    }

    toggleSidenavOpened() {
        this.sidenavOpened = !this.sidenavOpened;
    }

    /**
     * Sets `sidenavOpened` to the input boolean. Primarily used to update when the
     * user closes the sidenav by focusing the sidenav content.
     * @param opened boolean representing the status of the sidenav
     */
    setSidenavStatus(opened: boolean) {
        this.sidenavOpened = opened;
    }

    updateSelectedNodes() {
        this.selectedNodes = this.networkGraph.getSelectedNodes();
    }

    updateSelectedEdges() {
        this.selectedEdges = this.networkGraph.getSelectedEdges().filter(
            // Cluster edges are strings, normal edges are numbers. We do NOT want to include cluster edges
            // in our list of selected edges at the moment.
            edgeId => typeof edgeId === 'number'
        );
    }

    updateSelectedNodesAndEdges() {
        this.updateSelectedNodes();
        this.updateSelectedEdges();
    }

    clearSelectedNodeEdgeLabelData() {
        this.selectedNodeEdgeLabelData.clear();
    }

    updateSelectedNodeEdgeLabelData(selectedNode: IdType) {
        this.clearSelectedNodeEdgeLabelData();
        this.selectedNodeEdgeLabelData = this.getConnectedEdgeLabels(selectedNode);
    }

    collapseNeighbors(***ARANGO_USERNAME***Node: VisNode) {
        // Get all the nodes connected to the ***ARANGO_USERNAME*** node, before removing edges
        const connectedNodes = this.networkGraph.getConnectedNodes(***ARANGO_USERNAME***Node.id) as IdType[];

        this.edges.remove(this.networkGraph.getConnectedEdges(***ARANGO_USERNAME***Node.id) as IdType[]);

        // If a previously connected node has no remaining edges (i.e. it is not connected
        // to any other neighbor), remove it.
        const nodesToRemove = connectedNodes.map((connectedNodeId: number) => {
            const connectedEdges = this.networkGraph.getConnectedEdges(connectedNodeId);
            if (connectedEdges.length === 0) {
                return connectedNodeId;
            }
        });
        this.nodes.remove(nodesToRemove);
    }

    expandOrCollapseNode(nodeId: number) {
        const nodeRef = this.nodes.get(nodeId) as VisNode;
        const connectedNodes = this.networkGraph.getConnectedNodes(nodeId);

        connectedNodes.forEach(connectedNode => {
            if (this.networkGraph.isCluster(connectedNode)) {
                this.safelyOpenCluster(connectedNode);
            }
        });

        if (nodeRef.expanded) {
            // Updates node expand state
            const updatedNodeState = {...nodeRef, expanded: !nodeRef.expanded};
            this.nodes.update(updatedNodeState);
            // 'Collapse' all neighbor nodes that do not themselves have neighbors
            this.collapseNeighbors(nodeRef);
        } else {
            // Need to request new data from the parent when nodes are expanded
            const filterLabels = Object.keys(this.expandNodeForm.value).filter((key) => this.expandNodeForm.value[key]);
            this.expandNode.emit({
                nodeId,
                filterLabels,
            });
        }
    }

    /**
     * Gets the shared edges between the two input nodes.
     */
    getEdgesBetweenNodes(src: IdType, dest: IdType) {
        return this.networkGraph.getConnectedEdges(src).filter(
            edge => this.networkGraph.getConnectedEdges(dest).includes(edge)
        );
    }

    /**
     * Check that the input is a normal edge and that it isn't currently clustered.
     * Normal edges are numbers, cluster edges are strings. `getClusteredEdges` is
     * used here to deterimine if the input edge is currently clustered; The
     * output of getClusteredEdges is the input edge + any cluster edges it is contained
     * in if any.
     * @param edge the id of the edge to check
     */
    isNotAClusterEdge(edge: IdType) {
        return typeof edge !== 'string' && this.networkGraph.getClusteredEdges(edge).length === 1;
    }

    /**
     * Gets all the neighbors of the given node, connected by the given relationship, in the given direction.
     *
     * If `direction` is Direction.TO, we only want to get the neighbors where the edge is coming to `node`.
     * The opposite is true if `direction` is Direction.FROM.
     * @param relationship string representing the connecting relationship
     * @param node id of the ***ARANGO_USERNAME*** node
     * @param direction represents the direction of the connecting relationship
     */
    getNeighborsWithRelationship(relationship: string, node: IdType, direction: Direction) {
        return this.networkGraph.getConnectedEdges(node).filter(
            (edgeId) => {
                const edge = this.edges.get(edgeId) as VisEdge;
                // First check if this is the correct relationship
                if (this.isNotAClusterEdge(edgeId) && edge.label === relationship) {
                    // Then, check that it is in the correct direction
                    if (direction === Direction.FROM && edge.from === node) {
                        return true;
                    } else if (direction === Direction.TO && edge.to === node) {
                        return true;
                    }
                }
            }
        ).map(
            connectedEdgeWithRel => (this.networkGraph.getConnectedNodes(connectedEdgeWithRel) as IdType[]).filter(
                nodeId => nodeId !== node
            )[0]
        );
    }

    /**
     * Gets a set of labels from the edges connected to the input node.
     * @param selectedNode the ID of the node whose edge labels we want to get
     */
    getConnectedEdgeLabels(selectedNode: IdType): Map<string, Direction[]> {
        const labels = new Map<string, Direction[]>();

        this.networkGraph.getConnectedEdges(selectedNode).filter(
            edge => this.isNotAClusterEdge(edge)
        ).forEach(
            edgeId => {
                const edge = this.edges.get(edgeId) as VisEdge;
                const { label, from, to } = edge;

                if (!isNullOrUndefined(labels.get(label))) {
                    // Either `TO` or `FROM` is already in the direction list for this label, so check to see which one we need to add
                    const shouldAddTo = (selectedNode === to && !labels.get(label).includes(Direction.TO));
                    const shouldAddFrom = (selectedNode === from && !labels.get(label).includes(Direction.FROM));
                    if (shouldAddTo || shouldAddFrom) {
                        labels.set(label, [Direction.TO, Direction.FROM]);
                    }
                } else {
                    if (selectedNode === to) {
                        labels.set(label, [Direction.TO]);
                    } else {
                        labels.set(label, [Direction.FROM]);
                    }
                }
            }
        );
        return labels;
    }

    createClusterSvg(referenceTableRows: ReferenceTableRow[]) {
        referenceTableRows.sort((a, b) => b.snippetCount - a.snippetCount);
        const maxSnippetCount = referenceTableRows[0].snippetCount;
        const rowsHTMLString = referenceTableRows.slice(0, MAX_CLUSTER_ROWS).map((row, index) => {
            const percentOfMax = row.snippetCount === 0 ? row.snippetCount : (row.snippetCount / maxSnippetCount) * 100;

            let rowHTMLString = `
            <tr class="reference-table-row">
                <td class="entity-name-container">${row.nodeDisplayName}</td>
                <td class="snippet-count-container">(${row.snippetCount})</td>
                <td class="snippet-bar-container">
                    <div class="snippet-bar-repr" style="width: ${percentOfMax}px;"></div>
                </td>
            </tr>`;
            if (index === MAX_CLUSTER_ROWS - 1) {
                rowHTMLString += `
                <tr class="reference-table-row">
                    <td class="max-nodes-cell" colspan="3">Showing 20 of ${referenceTableRows.length} clustered nodes</td>
                </tr>
                `;
                return rowHTMLString;
            } else {
                return rowHTMLString;
            }
        }).join('\n');
        const ctx = document.getElementsByTagName('canvas')[0].getContext('2d');
        const longestName = referenceTableRows.slice(0, 20).sort(
            (a, b) => ctx.measureText(b.nodeDisplayName).width - ctx.measureText(a.nodeDisplayName).width
        )[0].nodeDisplayName;
        // width of biggest name + width of counts + max width of bars + padding width + border width
        const svgWidth = Math.floor((ctx.measureText(longestName).width * 1.25) + (ctx.measureText('(20+)').width * 1.25) + 100 + 21 + 6);
        // (height of rows + padding height + border height) * # of rows
        const svgHeight = (15 + 5 + 4) * referenceTableRows.slice(0, 20).length;
        const svg =
        `<svg xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" preserveAspectRatio="xMinYMin meet">
            <style type="text/css">
                table, td {
                    border-collapse: collapse;
                }

                td {
                    border: thin solid #C9CACC;
                    padding: 2.5px 3.5px;
                }

                .reference-table {
                    background: #D4E2F4;
                    border: thin solid #C9CACC;
                    border-radius: 2px;
                    color: #5B6A80;
                    font-family: "IBM Plex Sans", sans-serif;
                    font-size: 12px;
                    font-weight: bold;
                    height: ${svgHeight}px;
                    width: ${svgWidth}px;
                }

                .reference-table-row {
                    height: 15px;
                }

                .entity-name-container {
                    text-align: right;
                }

                .max-nodes-cell {
                    text-align: center;
                }

                .snippet-count-container {
                    text-align: center
                }

                .snippet-bar-container {
                    width: 100px;
                }

                .snippet-bar-repr {
                    height: 10px;
                    background: #aaabad;
                }
            </style>
            <foreignObject x="0" y="0" width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                    <table class="reference-table">${rowsHTMLString}</table>
                </div>
            </foreignObject>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    createOriginalNodeFromDuplicate(duplicateNode: DuplicateVisNode) {
        return {
            id: duplicateNode.duplicateOf,
            label: duplicateNode.label,
            data: duplicateNode.data,
            subLabels: duplicateNode.subLabels,
            displayName: duplicateNode.displayName,
            primaryLabel: duplicateNode.primaryLabel,
            expanded: duplicateNode.expanded,
            color: duplicateNode.color,
            font: duplicateNode.font,
        } as VisNode;
    }

    createDuplicateNodeFromOriginal(originalNode: VisNode) {
        const newDuplicateNodeId = 'duplicateNode:' + uuidv4();
        return {
            ...originalNode,
            id: newDuplicateNodeId,
            duplicateOf: originalNode.id,
        } as DuplicateVisNode;
    }

    createOriginalEdgeFromDuplicate(duplicateEdge: DuplicateVisEdge) {
        return {
            id: duplicateEdge.duplicateOf,
            label: duplicateEdge.label,
            data: duplicateEdge.data,
            to: duplicateEdge.originalTo,
            from: duplicateEdge.originalFrom,
            toLabel: duplicateEdge.toLabel,
            fromLabel: duplicateEdge.fromLabel,
            arrows: duplicateEdge.arrows,
            color: duplicateEdge.color,
        } as VisEdge;
    }

    createDuplicateEdgeFromOriginal(originalEdge: VisEdge, clusterOrigin: number, duplicateNode: DuplicateVisNode) {
        const newDuplicateEdgeId = 'duplicateEdge:' + uuidv4();
        return {
            ...originalEdge,
            id: newDuplicateEdgeId,
            duplicateOf: originalEdge.id,
            from: originalEdge.from === clusterOrigin ? clusterOrigin : duplicateNode.id,
            to: originalEdge.to === clusterOrigin ? clusterOrigin : duplicateNode.id,
            originalFrom: originalEdge.from,
            originalTo: originalEdge.to,
        } as DuplicateVisEdge;
    }

    /**
     * Pulls out a node from a cluster given a duplicate node ID. We find the cluster containing the given
     * ID, and then re-create the original node from the duplicate. This DOES NOT remove the duplicate
     * from the cluster! It simply re-draws the original using the duplicate's info. Also redraws the
     * original edge.
     *
     * @param duplicateNodeId ID of the duplicate node we wish to find
     */
    removeNodeFromCluster(duplicateNodeId: IdType) {
        const duplicateNode = this.nodes.get(duplicateNodeId) as DuplicateVisNode;

        // If the original node is not currently drawn on the canvas, redraw it.
        if (isNullOrUndefined(this.nodes.get(duplicateNode.duplicateOf))) {
            this.nodes.update(this.createOriginalNodeFromDuplicate(duplicateNode));
        }

        // Redraw the original edge
        this.networkGraph.getConnectedEdges(duplicateNodeId).map(
            duplicateEdgeId => this.edges.get(duplicateEdgeId)
        ).forEach(duplicateEdge => {
            this.edges.update(this.createOriginalEdgeFromDuplicate(duplicateEdge));
        });
    }

    /**
     * Helper method for cleaning up the canvas after a cluster is opened. All cluster
     * nodes/edges are duplicates, so we have to remove them when a cluster is opened.
     * We also redraw the originals if they are not already present on the canvas.
     * @param nodesInCluster the list of duplicate node IDs in the opened cluster
     */
    cleanUpDuplicates(nodesInCluster: IdType[]) {
        const edgesToRemove = [];
        const nodesToRemove = [];
        const edgesToAdd = [];
        const nodesToAdd = [];

        nodesInCluster.forEach(duplicateNodeId => {
            const duplicateNode = this.nodes.get(duplicateNodeId) as DuplicateVisNode;
            // If the original node is not currently drawn on the canvas, redraw it
            if (isNullOrUndefined(this.nodes.get(duplicateNode.duplicateOf))) {
                nodesToAdd.push(this.createOriginalNodeFromDuplicate(duplicateNode));
            }

            this.networkGraph.getConnectedEdges(duplicateNodeId).map(
                duplicateEdgeId => this.edges.get(duplicateEdgeId)
            ).forEach(duplicateEdge => {
                this.removeDuplicatedEdge.emit(duplicateEdge.duplicateOf);
                edgesToRemove.push(duplicateEdge.id);
                edgesToAdd.push(this.createOriginalEdgeFromDuplicate(duplicateEdge));
            });

            nodesToRemove.push(duplicateNodeId);
        });

        this.nodes.remove(nodesToRemove);
        this.edges.remove(edgesToRemove);

        this.nodes.update(nodesToAdd);
        this.edges.update(edgesToAdd);
    }

    /**
     * Helper method for creating duplicate nodes and edges given clustering information. All
     * nodes/edges within a cluster are duplicates of the original nodes. This is done so we
     * can view the original node if it would still have some remaining edges after clustering.
     * This method does NOT alter the network data, it only creates duplicate node/edge objects.
     * @param neighborNodesWithRel the list of original node IDs to be clustered
     * @param relationship the relationship which is being clustered
     * @param node the source node for the cluster
     */
    createDuplicateNodesAndEdges(neighborNodesWithRel: IdType[], relationship: string, clusterOrigin: IdType, direction: Direction) {
        return neighborNodesWithRel.map((neighborNodeId) => {
            let edges = this.networkGraph.getConnectedEdges(neighborNodeId);
            const newDuplicateNode = this.createDuplicateNodeFromOriginal(this.nodes.get(neighborNodeId));

            edges = edges.filter(
                id => {
                    const edge = this.edges.get(id);
                    // Make sure the edges we duplicate have the grouped relationship and that they are connected to the cluster origin
                    if (this.isNotAClusterEdge(id) && edge.label === relationship) {
                        // Then, check that it is in the correct direction
                        if (direction === Direction.FROM && edge.from === clusterOrigin) {
                            return true;
                        } else if (direction === Direction.TO && edge.to === clusterOrigin) {
                            return true;
                        }
                    }
                    return false;
                }
            );

            if (edges.length !== 1) {
                throw Error(
                    `Neighbor node should have exactly one edge between origin node ${clusterOrigin} ` +
                    `with label ${relationship} and direction ${direction}. Found ${edges.length} instead`
                );
            }

            const newDuplicateEdge = this.createDuplicateEdgeFromOriginal(
                this.edges.get(edges[0]), clusterOrigin as number, newDuplicateNode
            );

            return {
                node: newDuplicateNode,
                edge: newDuplicateEdge,
            } as DuplicateNodeEdgePair;
        });
    }

    /**
     * Helper function for updating the graph with duplicate nodes and edges. Used by groupNeighborsWithRelationship
     * to prep for clustering.
     *
     * If a node would have no remaining edges after clustering, we remove it from the canvas
     * entirely. It and its corresponding edge will be redrawn when the cluster is opened.
     * @param duplicateNodeEdgePairs the list of duplicate node/edge pairs to update the network with
     */
    updateGraphWithDuplicates(duplicateNodeEdgePairs: DuplicateNodeEdgePair[]) {
        const duplicateNodesToAdd = [];
        const duplicateEdgesToAdd = [];
        const nodesToRemove = [];
        const edgesToRemove = [];

        duplicateNodeEdgePairs.forEach(pair => {
            const duplicateNode = pair.node;
            const duplicateEdge = pair.edge;
            const edges = this.networkGraph.getConnectedEdges(duplicateNode.duplicateOf);

            duplicateNodesToAdd.push(duplicateNode);
            duplicateEdgesToAdd.push(duplicateEdge);

            if (edges.length === 1) {
                // If the original node is being clustered on its last unclustered edge,
                // remove it entirely from the canvas.
                nodesToRemove.push(duplicateNode.duplicateOf);
            }

            this.addDuplicatedEdge.emit(duplicateEdge.duplicateOf as number);
            edgesToRemove.push(duplicateEdge.duplicateOf);
        });

        this.edges.remove(edgesToRemove);
        this.nodes.remove(nodesToRemove);

        this.nodes.update(duplicateNodesToAdd);
        this.edges.update(duplicateEdgesToAdd);
    }

    safelyOpenCluster(clusterNodeId) {
        const nodesInCluster = this.networkGraph.getNodesInCluster(clusterNodeId);

        // Clean up the cluster
        this.networkGraph.openCluster(clusterNodeId);
        this.clusters.delete(clusterNodeId as string);

        this.cleanUpDuplicates(nodesInCluster);
    }

    destroyCluster(clusterNodeId: IdType) {
        const nodesInCluster = this.networkGraph.getNodesInCluster(clusterNodeId);
        const edgesInCluster = [];

        nodesInCluster.forEach(nodeId => {
            this.networkGraph.getConnectedEdges(nodeId).forEach(edgeId => edgesInCluster.push(edgeId));
        });

        // Destroy the cluster
        this.networkGraph.openCluster(clusterNodeId);
        this.clusters.delete(clusterNodeId as string);

        this.nodes.remove(nodesInCluster);
        this.edges.remove(edgesInCluster);
    }

    createCluster(originNode: IdType, relationship: string, duplicateNodeEdgePairs: DuplicateNodeEdgePair[]) {
        this.openClusteringRequests += 1;
        this.visService.getReferenceTableData(duplicateNodeEdgePairs).subscribe(result => {
            // Remove any existing clusters connected to the origin node on this relationship first. Any
            // nodes within should have been included in the duplicateNodeEdgePairs array sent to the appserver.
            this.networkGraph.getConnectedNodes(originNode).forEach(nodeId => {
                if (this.networkGraph.isCluster(nodeId)) {
                    if (this.clusters.get(nodeId).relationship === relationship) {
                        this.destroyCluster(nodeId);
                    }
                }
            });

            this.updateGraphWithDuplicates(duplicateNodeEdgePairs);

            const referenceTableRows = result.referenceTableRows;
            const url = this.createClusterSvg(referenceTableRows);

            // TODO: Would be nice to have some indication that the cluster has been selected.
            // A bit tricky, since clusters are SVGs, but maybe this can be done.
            this.networkGraph.cluster({
                joinCondition: (n) => duplicateNodeEdgePairs.map(pair => pair.node.id).includes(n.id),
                clusterNodeProperties: {
                    image: url,
                    label: null,
                    shape: 'image',
                    shapeProperties: {
                        useImageSize: true,
                    },
                    size: this.config.nodes.size,
                    // This setting is valid as described under 'clusterNodeProperties'
                    // here: https://visjs.github.io/vis-network/docs/network/index.html#optionsObject
                    // @ts-ignore
                    allowSingleNodeCluster: true,
                },
                clusterEdgeProperties: {
                    label: relationship,
                },
                processProperties: (clusterOptions) => {
                    const newClusterId = `cluster:${uuidv4()}`;
                    this.clusters.set(newClusterId, {referenceTableRows, relationship});
                    return {...clusterOptions, id: newClusterId};
                }
            });

            this.updateSelectedNodeEdgeLabelData(originNode);
            this.openClusteringRequests -= 1;
            this.clusterCreatedSource.next(true);
        });
    }

    getDuplicateNodeEdgePairsFromCluster(clusterNodeId: IdType) {
        const clusteredNodeIds = this.networkGraph.getNodesInCluster(clusterNodeId);
        const duplicateNodeEdgePairs = [];

        clusteredNodeIds.forEach(nodeId => {
            this.networkGraph.getConnectedEdges(nodeId).forEach(edgeId => {
                duplicateNodeEdgePairs.push(
                    {
                        node: this.nodes.get(nodeId),
                        edge: this.edges.get(edgeId),
                    } as DuplicateNodeEdgePair
                );
            });
        });

        return duplicateNodeEdgePairs;
    }

    /**
     * Creates a cluster node of all the neighbors connected to the currently selected
     * node connected by the input relationship.
     * @param rel a string representing the relationship the neighbors will be clustered on
     */
    groupNeighborsWithRelationship(groupRequest: GroupRequest) {
        const { relationship, node, direction } = groupRequest;
        let duplicateNodeEdgePairs: DuplicateNodeEdgePair[] = [];

        const neighborNodesWithRel = this.getNeighborsWithRelationship(relationship, node, direction);

        try {
            const duplicateNodeEdgePairsOutsideCluster = this.createDuplicateNodesAndEdges(
                neighborNodesWithRel, relationship, node, direction
            );
            duplicateNodeEdgePairs = duplicateNodeEdgePairs.concat(duplicateNodeEdgePairsOutsideCluster);

            this.networkGraph.getConnectedNodes(node).forEach(nodeId => {
                if (this.networkGraph.isCluster(nodeId)) {
                    if (this.clusters.get(nodeId).relationship === relationship) {
                        // If the hub node is already connected to a cluster on the given relationship,
                        // we should include all the nodes in that cluster.
                        const duplicateNodesEdgePairsInCluster = this.getDuplicateNodeEdgePairsFromCluster(
                            nodeId
                        ).filter(
                            // It is possible that some of the nodes inside the cluster sre also outside it. So,
                            // get rid of duplicates.
                            (pair: DuplicateNodeEdgePair) => !neighborNodesWithRel.includes(pair.node.duplicateOf)
                        );
                        duplicateNodeEdgePairs = duplicateNodeEdgePairs.concat(duplicateNodesEdgePairsInCluster);
                    }
                }
            });
        } catch (e) {
            console.log(e);
            this.messageDialog.display(
                {
                    title: 'Clustering Error!',
                    message: `An error occurred while trying to cluster node with ID ${node} on relationship ` +
                    `${relationship} in direction "${direction}". `,
                    type: MessageType.Error
                }
            );
            return;
        }

        this.createCluster(node, relationship, duplicateNodeEdgePairs);
    }

    removeEdges(edges: IdType[]) {
        edges.forEach(edge => {
            this.edges.remove(edge);
        });
    }

    // TODO: We need to consider flipping the 'expanded' property of any nodes where after this process finishes, the node
    // no longer has any neighbors. Otherwise, if we remove all the connected nodes from a given node, the user will have to
    // double click on that node twice to re-expand the node.
    removeNodes(nodes: IdType[]) {
        const edgesToRemove = [];
        const nodesToRemove = nodes.map(node => {
            this.networkGraph.getConnectedNodes(node).forEach(connectedNode => {
                if (this.networkGraph.isCluster(connectedNode)) {
                    this.safelyOpenCluster(connectedNode);
                }
            });
            this.networkGraph.getConnectedEdges(node).forEach(edge => {
                edgesToRemove.push(edge);
            });
            return node;
        });

        this.nodes.remove(nodesToRemove);
        this.edges.remove(edgesToRemove);
    }

    selectNeighbors(node: IdType) {
        this.networkGraph.selectNodes(this.networkGraph.getConnectedNodes(node) as IdType[]);
        this.updateSelectedNodes();
    }

    /**
     * Opens the metadata sidebar with the input node's data
     * @param edge represents a non-cluster edge on the canvas
     */
    getAssociationsWithEdge(edge: VisEdge) {
        this.getSnippetsFromEdge.emit(edge);
    }

    getAssociationsWithDuplicateEdge(edge: DuplicateVisEdge) {
        this.getSnippetsFromDuplicateEdge.emit(edge);
    }

    updateSidebarEntity() {
        if (this.selectedNodes.length === 1 && this.selectedEdges.length === 0) {
            if (this.networkGraph.isCluster(this.selectedNodes[0])) {
                const cluster = this.selectedNodes[0];
                const clusteredNodes = this.networkGraph.getNodesInCluster(cluster).map(node => {
                    return {
                        nodeId: node,
                        edges: this.networkGraph.getConnectedEdges(node).map(edgeId => this.edges.get(edgeId)),
                    } as ClusteredNode;
                });
                this.getClusterData.emit(clusteredNodes);
            } else {
                const node  = this.nodes.get(this.selectedNodes[0]) as VisNode;
                this.sidenavEntity = {
                    data: node,
                    edges: this.networkGraph.getConnectedEdges(node.id).map(edgeId => this.edges.get(edgeId))
                } as SidenavNodeEntity;
                this.sidenavEntityType = SidenavEntityType.NODE;
            }
        } else if (this.selectedNodes.length === 0 && this.selectedEdges.length === 1) {
            const edge = this.edges.get(this.selectedEdges[0]) as VisEdge;
            this.getAssociationsWithEdge(edge);
        }
    }

    /**
     * Contains all of the event handling features for the
     * network graph.
     */
    visualizerSetupEventBinds() {
        this.networkGraph.on('click', (params) => {
            this.onClickCallback(params);
            // TODO: May want to disable some of the default behaviors. For example,
            // if a user selected some nodes, and then clicks anywhere, all the nodes are
            // deselected. This may be contrary to what users expect (e.g. I would expect
            // that if I selected some things and I clicked on one of them I wouldn't
            // deselect everything). There may also be other behaviors we don't want.
        });

        this.networkGraph.on('dragStart', (params) => {
            this.onDragStartCallback(params);
        });

        this.networkGraph.on('dragEnd', (params) => {
            this.onDragEndCallback(params);
        });

        this.networkGraph.on('hoverNode', (params) => {
            this.onHoverNodeCallback(params);
        });

        this.networkGraph.on('blurNode', (params) => {
            this.onBlurNodeCallback(params);
        });

        this.networkGraph.on('selectNode', (params) => {
            this.onSelectNodeCallback(params);
        });

        this.networkGraph.on('deselectNode', (params) => {
            this.onDeselectNodeCallback(params);
        });

        this.networkGraph.on('selectEdge', (params) => {
            this.onSelectEdgeCallback(params);
        });

        this.networkGraph.on('deselectEdge', (params) => {
            this.onDeselectEdgeCallback(params);
        });

        this.networkGraph.on('doubleClick', (params) => {
            this.onDoubleClickCallback(params);
        });

        this.networkGraph.on('oncontext', (params) => {
            this.onContextCallback(params);
        });
    }

    hideAllTooltips() {
        this.contextMenuControlService.hideTooltip();
    }

    // Begin Callback Functions

    onClickCallback(params: any) {
        this.hideAllTooltips();
    }

    onDragStartCallback(params: any) {
        this.hideAllTooltips();
    }

    onDragEndCallback(params: any) {
        // Dragging a node doesn't fire node selection, but it is selected after dragging finishes, so update
        this.updateSelectedNodes();
    }

    onHoverNodeCallback(params: any) {
        if (this.networkGraph.isCluster(params.node)) {
            // TODO: Add on-hover cluster effects
        } else if (!this.nodes.get(params.node)) {
            // TODO: Add on-hover edge effects
        } else {
            // This produces an 'enlarge effect'
            // TODO: Currently this does nothing, because the size property does not change 'box' shape nodes.
            // May be able to use the 'scaling' property to produce the desired effect.
            // const node = this.nodes.get(params.node);
            // const updatedNode = {...node, size: this.config.nodes.size * 1.5};
            // this.nodes.update(updatedNode);
        }
    }

    onBlurNodeCallback(params: any) {
        if (this.networkGraph.isCluster(params.node)) {
            // TODO: Add on-blur cluster effects
        } else if (!this.nodes.get(params.node)) {
            // TODO: Add on-blur edge effects
        } else {
            // This produces a 'shrink effect'
            // TODO: Currently this does nothing, because the size property does not change 'box' shape nodes.
            // May be able to use the 'scaling' property to produce the desired effect.
            // const node = this.nodes.get(params.node);
            // const updateNode = {...node, size: this.config.nodes.size};
            // this.nodes.update(updateNode);
        }
    }

    onSelectNodeCallback(params: any) {
        this.updateSelectedNodes();
        this.updateSidebarEntity();
    }

    onDeselectNodeCallback(params: any) {
        // TODO: Minor bug: this is causing the context-menu to briefly show the
        // "no selected entities" menu template during the fade-out animation. Could
        // add a timeout here equal to the length of the animation, but maybe there's
        // a better solution?
        this.updateSelectedNodes();
    }

    onSelectEdgeCallback(params: any) {
        this.updateSelectedEdges();
        this.updateSidebarEntity();
    }

    onDeselectEdgeCallback(params: any) {
        // TODO: Same bug as described in "onDeselectNodeCallback"
        this.updateSelectedEdges();
    }

    onDoubleClickCallback(params: any) {
        const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);

        if (this.networkGraph.isCluster(hoveredNode)) {
            this.safelyOpenCluster(hoveredNode);
            return;
        }

        // Check if event is double clicking a node
        if (hoveredNode) {
            this.expandOrCollapseNode(hoveredNode as number);
        }
    }

    onContextCallback(params: any) {
        const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM) as string;

        if (this.networkGraph.isCluster(hoveredNode)) {
            const nodeIdToSnippetCountMap = new Map<string, number>();
            this.clusters.get(hoveredNode).referenceTableRows.forEach(nodeRow =>
                nodeIdToSnippetCountMap.set(nodeRow.nodeId, nodeRow.snippetCount)
            );
            this.selectedClusterNodeData = this.networkGraph.getNodesInCluster(hoveredNode).map(
                nodeId => this.nodes.get(nodeId) as VisNode
            ).sort(
                (a, b) => nodeIdToSnippetCountMap.get(b.id.toString()) - nodeIdToSnippetCountMap.get(a.id.toString())
            ).slice(0, MAX_CLUSTER_ROWS);
        } else {
            this.selectedClusterNodeData = [];
        }

        // Stop the browser from showing the normal context
        params.event.preventDefault();

        // Update the canvas location
        const canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;

        const contextMenuXPos = params.pointer.DOM.x + canvas.x;
        const contextMenuYPos = params.pointer.DOM.y + canvas.y;

        this.contextMenuControlService.updatePopper(contextMenuXPos, contextMenuYPos);

        const hoveredEdge = this.networkGraph.getEdgeAt(params.pointer.DOM);
        const currentlySelectedNodes = this.networkGraph.getSelectedNodes();
        const currentlySelectedEdges = this.networkGraph.getSelectedEdges();

        if (hoveredNode !== undefined) {
            if (currentlySelectedNodes.length === 0 || !currentlySelectedNodes.includes(hoveredNode)) {
                this.networkGraph.selectNodes([hoveredNode], false);
            }
        } else if (hoveredEdge !== undefined) {
            if (currentlySelectedEdges.length === 0 || !currentlySelectedEdges.includes(hoveredEdge)) {
                this.networkGraph.selectEdges([hoveredEdge]);
            }
        } else {
            this.networkGraph.unselectAll();
        }

        this.updateSelectedNodesAndEdges();

        if (this.selectedNodes.length === 1 && this.selectedEdges.length === 0) {
            this.updateSelectedNodeEdgeLabelData(this.selectedNodes[0]);
        } else {
            // Clean up the selected node edge labels if we selected more than one node, or any edges
            // (this should prevent stale data in the context menu component)
            this.clearSelectedNodeEdgeLabelData();
        }
        this.contextMenuControlService.showTooltip();
        this.updateSidebarEntity(); // oncontext does not select the hovered entity by default, so update
      }

      // End Callback Functions
}
