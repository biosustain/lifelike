import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';

import { Options } from '@popperjs/core';

import { isNullOrUndefined } from 'util';

import { Network, DataSet, IdType } from 'vis-network';

import {
    ClusteredNode,
    DuplicateNodeEdgePair,
    DuplicateVisEdge,
    DuplicateVisNode,
    GetClusterGraphDataResult,
    GetSnippetsResult,
    GroupRequest,
    Neo4jGraphConfig,
    SidenavClusterEntity,
    SidenavNodeEntity,
    SidenavEdgeEntity,
    VisEdge,
    VisNode,
} from 'app/interfaces';

import { uuidv4 } from 'app/shared/utils';

import { ContextMenuControlService } from '../../services/context-menu-control.service';

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
    @Output() expandNode = new EventEmitter<number>();
    @Output() getSnippetsFromEdge = new EventEmitter<VisEdge>();
    @Output() getSnippetsFromDuplicateEdge = new EventEmitter<DuplicateVisEdge>();
    @Output() getClusterGraphData = new EventEmitter<ClusteredNode[]>();
    @Output() addDuplicatedEdge = new EventEmitter<number>();
    @Output() removeDuplicatedEdge = new EventEmitter<number>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    @Input() set getSnippetsResult(result: GetSnippetsResult) {
        if (!isNullOrUndefined(result)) {
            this.sidenavEntityType = SidenavEntityType.EDGE;
            this.sidenavEntity = {
                to: this.nodes.get(result.toNodeId) as VisNode,
                from: this.nodes.get(result.fromNodeId) as VisNode,
                association: result.association,
                snippets: result.snippets,
             } as SidenavEdgeEntity;
        }
    }
    @Input() set getClusterGraphDataResult(result: GetClusterGraphDataResult) {
        if (!isNullOrUndefined(result)) {
            this.sidenavEntityType = SidenavEntityType.CLUSTER;
            this.sidenavEntity = {
                includes: Object.keys(result.results).map(nodeId => this.nodes.get(nodeId)),
                clusterGraphData: result,
            } as SidenavClusterEntity;
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
    selectedNodeEdgeLabels: Set<string>;
    selectedEdges: IdType[];
    referenceTableData: DuplicateNodeEdgePair[];
    clusters: Map<string, string>;

    contextMenuTooltipSelector: string;
    contextMenuTooltipOptions: Partial<Options>;
    referenceTableTooltipSelector: string;
    referenceTableTooltipOptions: Partial<Options>;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {
        this.sidenavOpened = false;
        this.sidenavEntity = null;
        this.sidenavEntityType = SidenavEntityType.EMPTY;

        this.selectedNodes = [];
        this.selectedEdges = [];
        this.selectedNodeEdgeLabels = new Set<string>();
        this.referenceTableData = [];

        this.contextMenuTooltipSelector = '#root-menu';
        this.contextMenuTooltipOptions = {
            placement: 'right-start',
        };

        this.referenceTableTooltipSelector = '#root-table';
        this.referenceTableTooltipOptions = {
            placement: 'right-start',
        };

        this.clusters = new Map<string, string>();
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

    clearSelectedNodeEdgeLabels() {
        this.selectedNodeEdgeLabels.clear();
    }

    updateSelectedNodeEdgeLabels(selectedNode: IdType) {
        this.clearSelectedNodeEdgeLabels();
        const edgeLabelsResult = this.getConnectedEdgeLabels(selectedNode);
        edgeLabelsResult.forEach(label => this.selectedNodeEdgeLabels.add(label));
    }

    collapseNeighbors(rootNode: VisNode) {
        // Get all the nodes connected to the root node, before removing edges
        const connectedNodes = this.networkGraph.getConnectedNodes(rootNode.id) as IdType[];
        (this.networkGraph.getConnectedEdges(rootNode.id) as IdType[]).forEach(
            connectedEdge => {
                this.edges.remove(connectedEdge);
            }
        );

        // If a previously connected node has no remaining edges (i.e. it is not connected
        // to any other neighbor), remove it.
        connectedNodes.forEach((connectedNodeId: number) => {
            const connectedEdges = this.networkGraph.getConnectedEdges(connectedNodeId);
            if (connectedEdges.length === 0) {
                this.nodes.remove(connectedNodeId);
            }
        });
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
            this.expandNode.emit(nodeId);
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
     * Gets all the neighbors of the given node connected by the given relationship.
     * @param relationship string representing the connecting relationship
     * @param node id of the root node
     */
    getNeighborsWithRelationship(relationship: string, node: IdType) {
        return this.networkGraph.getConnectedEdges(node).filter(
            (edgeId) => this.isNotAClusterEdge(edgeId) && this.edges.get(edgeId).label === relationship
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
    getConnectedEdgeLabels(selectedNode: IdType) {
        const labels = new Set<string>();

        this.networkGraph.getConnectedEdges(selectedNode).filter(
            edge => this.isNotAClusterEdge(edge)
        ).forEach(
            edge => labels.add(this.edges.get(edge).label)
        );

        return labels;
    }

    createClusterSvg(clusterDisplayNames: string[], totalClusteredNodes: number) {
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="232" height="120">' +
                '<style type="text/css">' +
                    '.cluster-node {' +
                        'background: #D4E2F4;' +
                        'border-radius: 2px;' +
                        'border: thin solid #C9CACC;' +
                        'color: #5B6A80;' +
                        'display: inline-block;' +
                        'font-family: "IBM Plex Sans", sans-serif;' +
                        'font-size: 12px;' +
                        'font-weight: bold;' +
                        'width: 215px' +
                    '}' +
                    '.cluster-node-row {' +
                        'border: thin solid #C9CACC; ' +
                        'height: 15px; ' +
                        'padding: 5px;' +
                        'text-align: left; ' +
                        'vertical-align: middle; ' +
                    '}' +
                '</style>' +
                '<foreignObject x="15" y="10" width="100%" height="100%">' +
                    `<div class="cluster-node" xmlns="http://www.w3.org/1999/xhtml">` +
                        ''.concat(...clusterDisplayNames,
                            '<div class="cluster-node-row">... (Showing ' +
                                `${totalClusteredNodes > 3 ? '3' : totalClusteredNodes.toString()} of ${totalClusteredNodes} total items)` +
                            '</div>') +
                    '</div>' +
                '</foreignObject>' +
            '</svg>';

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
            arrows: duplicateEdge.arrows,
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
     * Helper method for cleaning up the canvas after a cluster is opened. All cluster
     * nodes/edges are duplicates, so we have to remove them when a cluster is opened.
     * We also redraw the originals if they are not already present on the canvas.
     * @param nodesInCluster the list of duplicate node IDs in the opened cluster
     */
    cleanUpDuplicates(nodesInCluster: IdType[]) {
        nodesInCluster.forEach(duplicateNodeId => {
            const duplicateNode = this.nodes.get(duplicateNodeId) as DuplicateVisNode;
            // If the original node is not currently drawn on the canvas, redraw it
            if (isNullOrUndefined(this.nodes.get(duplicateNode.duplicateOf))) {
                this.nodes.update(this.createOriginalNodeFromDuplicate(duplicateNode));
            }

            this.networkGraph.getConnectedEdges(duplicateNodeId).map(
                duplicateEdgeId => this.edges.get(duplicateEdgeId)
            ).forEach(duplicateEdge => {
                this.removeDuplicatedEdge.emit(duplicateEdge.duplicateOf);
                this.edges.remove(duplicateEdge.id);
                this.edges.update(this.createOriginalEdgeFromDuplicate(duplicateEdge));
            });

            this.nodes.remove(duplicateNodeId);
        });
    }

    /**
     * Helper method for creating duplicate nodes and edges given clustering information. All
     * nodes/edges within a cluster are duplicates of the original nodes. This is done so we
     * can view the original node if it would still have some remaining edges after clustering.
     * If a node would have no remaining edges after clustering, we remove it from the canvas
     * entirely. It and its corresponding edge will be redrawn when the cluster is opened.
     * @param neighborNodesWithRel the list of original node IDs to be clustered
     * @param relationship the relationship which is being clustered
     * @param node the source node for the cluster
     */
    createDuplicateNodesAndEdges(neighborNodesWithRel: IdType[], relationship: string, clusterOrigin: IdType) {
        return neighborNodesWithRel.map((neighborNodeId) => {
            const edges = this.networkGraph.getConnectedEdges(neighborNodeId);
            const newDuplicateNode = this.createDuplicateNodeFromOriginal(this.nodes.get(neighborNodeId));
            this.nodes.update(newDuplicateNode);

            if (edges.length === 1) {
                // If the original node is being clustered on its last unclustered edge,
                // remove it entirely from the canvas.
                this.nodes.remove(neighborNodeId);
            }

            edges.filter(
                edgeId => {
                    const edge = this.edges.get(edgeId);
                    // Make sure the edges we duplicate have the grouped relationship and that they are connected to the cluster origin
                    return edge.label === relationship && (edge.from === clusterOrigin || edge.to === clusterOrigin);
                }
            ).forEach(
                edgeId => {
                    const existingEdge = this.edges.get(edgeId);
                    this.addDuplicatedEdge.emit(edgeId as number);
                    this.edges.update(this.createDuplicateEdgeFromOriginal(existingEdge, clusterOrigin as number, newDuplicateNode));
                    this.edges.remove(existingEdge);
                }
            );
            return newDuplicateNode.id;
        });
    }

    safelyOpenCluster(clusterNodeId) {
        const nodesInCluster = this.networkGraph.getNodesInCluster(clusterNodeId);

        // Clean up the cluster
        this.networkGraph.openCluster(clusterNodeId);
        this.clusters.delete(clusterNodeId as string);

        this.cleanUpDuplicates(nodesInCluster);
    }

    /**
     * Creates a cluster node of all the neighbors connected to the currently selected
     * node connected by the input relationship.
     * @param rel a string representing the relationship the neighbors will be clustered on
     */
    groupNeighborsWithRelationship(groupRequest: GroupRequest) {
        const { relationship, node } = groupRequest;
        let neighborNodesWithRel = this.getNeighborsWithRelationship(relationship, node);
        neighborNodesWithRel = this.createDuplicateNodesAndEdges(neighborNodesWithRel, relationship, node);

        const clusterDisplayNames: string[] = neighborNodesWithRel.map(
            (nodeId) => {
                let displayName = this.nodes.get(nodeId).displayName;
                if (displayName.length > 31) {
                    displayName = displayName.slice(0, 31) + '...';
                }
                return `<div class="cluster-node-row">${displayName}</div>`;
            }
        ).slice(0, 3);
        const url = this.createClusterSvg(clusterDisplayNames, neighborNodesWithRel.length);

        // TODO: Would be nice to have some indication that the cluster has been selected.
        // A bit tricky, since clusters are SVGs, but maybe this can be done.
        this.networkGraph.cluster({
            joinCondition: (n) => neighborNodesWithRel.includes(n.id),
            clusterNodeProperties: {
                image: url,
                label: null,
                shape: 'image',
                size: this.config.nodes.size * 1.5,
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
                this.clusters.set(newClusterId, relationship);
                return {...clusterOptions, id: newClusterId};
            }
        });

        this.updateSelectedNodeEdgeLabels(node);
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
        nodes.forEach(node => {
            this.networkGraph.getConnectedNodes(node).forEach(connectedNode => {
                if (this.networkGraph.isCluster(connectedNode)) {
                    this.safelyOpenCluster(connectedNode);
                }
            });
            this.networkGraph.getConnectedEdges(node).forEach(edge => {
                this.edges.remove(edge);
            });
            this.nodes.remove(node);
        });
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
                this.getClusterGraphData.emit(clusteredNodes);
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

    getNodeEdgePairsInCluster(clusterNodeId: string) {
        const clusterEdgeRelationship = this.clusters.get(clusterNodeId);
        return this.networkGraph.getNodesInCluster(clusterNodeId).map(
            duplicateNodeId => {
                // Get each clustered node and edge. There should be EXACTLY
                // one edge connected to this node, and both the node and edge are
                // duplicates.
                try {
                    if (typeof duplicateNodeId !== 'string') {
                        throw Error(`Cluster node ID was of type ${typeof duplicateNodeId}! Should be 'string'`);
                    } else if (this.networkGraph.getConnectedEdges(duplicateNodeId).length !== 1) {
                        throw Error(
                            `Cluster node with id ${duplicateNodeId} has ` +
                            `${this.networkGraph.getConnectedEdges(duplicateNodeId).length} edges! Should be 1.`
                        );
                    }

                    const duplicateEdgeId = this.networkGraph.getConnectedEdges(duplicateNodeId).pop();

                    if (this.edges.get(duplicateEdgeId).label !== clusterEdgeRelationship) {
                        throw Error(
                            `Edge ${duplicateEdgeId} of node ${duplicateNodeId} had label ` +
                            `${this.edges.get(duplicateEdgeId).label}! Should be ${clusterEdgeRelationship}` +
                            `Clustered edges should all have the same label.`
                        );
                    }
                    return {
                        node: this.nodes.get(duplicateNodeId),
                        edge: this.edges.get(duplicateEdgeId),
                    } as DuplicateNodeEdgePair;
                } catch (e) {
                    console.log(e);
                }
            }
        );
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
        this.updateSelectedNodes(); // Dragging a node doesn't fire node selection, but it is selected after dragging finishes, so update
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
        const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);

        if (this.networkGraph.isCluster(hoveredNode)) {
            return;
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
            this.updateSelectedNodeEdgeLabels(this.selectedNodes[0]);
        } else {
            // Clean up the selected node edge labels if we selected more than one node, or any edges
            // (this should prevent stale data in the context menu component)
            this.clearSelectedNodeEdgeLabels();
        }
        this.contextMenuControlService.showTooltip();
        this.updateSidebarEntity(); // oncontext does not select the hovered entity by default, so update
      }

      // End Callback Functions
}
