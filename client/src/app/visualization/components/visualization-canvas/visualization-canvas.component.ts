import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';

import { Options } from '@popperjs/core';

import { first, filter } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { Network, DataSet, IdType } from 'vis-network';

import {
    AssociationData,
    GetLabelsResult,
    GetSnippetsResult,
    GraphRelationship,
    GroupRequest,
    Neo4jGraphConfig,
    ReferenceTableRow,
    SidenavEntity,
    VisNode,
    SidenavClusterEntity,
    SidenavNodeEntity,
    SidenavEdgeEntity,

} from 'app/interfaces';

import { uuidv4 } from 'app/shared/utils';

import { ContextMenuControlService } from '../../services/context-menu-control.service';
import { ReferenceTableControlService } from '../../services/reference-table-control.service';

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
    providers: [ContextMenuControlService, ReferenceTableControlService],
})
export class VisualizationCanvasComponent implements OnInit {
    @Output() expandNode = new EventEmitter<number>();
    @Output() getSnippets = new EventEmitter<AssociationData>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    @Input() set getSnippetsResult(result: GetSnippetsResult) {
        if (!isNullOrUndefined(result)) {
            this.sidenavEntityType = 'edge';
            this.sidenavOpened = true;
            this.sidenavEntity = {
                to: this.nodes.get(result.toNode) as VisNode,
                from: this.nodes.get(result.fromNode) as VisNode,
                association: result.association,
                references: result.references,
             } as SidenavEdgeEntity;
        }
    }
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;
    @Input() legend: Map<string, string[]>;

    sidenavOpened: boolean;
    sidenavEntity: SidenavEntity;
    sidenavEntityType: string;

    networkGraph: Network;
    selectedNodes: IdType[];
    selectedNodeEdgeLabels: GetLabelsResult;
    selectedEdges: IdType[];
    nodesInHoveredCluster: ReferenceTableRow[];
    clusters: Map<string, string>;

    contextMenuTooltipSelector: string;
    contextMenuTooltipOptions: Partial<Options>;
    referenceTableTooltipSelector: string;
    referenceTableTooltipOptions: Partial<Options>;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
        private referenceTableControlService: ReferenceTableControlService,
    ) {
        this.sidenavOpened = false;
        this.sidenavEntity = null;
        this.sidenavEntityType = 'null';

        this.selectedNodes = [];
        this.selectedEdges = [];
        this.selectedNodeEdgeLabels = {validLabels: new Set<string>(), invalidLabels: new Set<string>()};
        this.nodesInHoveredCluster = [];

        this.contextMenuTooltipSelector = '#***ARANGO_USERNAME***-menu';
        this.contextMenuTooltipOptions = {
            placement: 'right-start',
        };

        this.referenceTableTooltipSelector = '#***ARANGO_USERNAME***-table';
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
        if (animationOn) {
            this.networkGraph.setOptions({physics: true});
        } else {
            this.networkGraph.setOptions({physics: false});
        }
    }

    toggleSidenavOpened() {
        this.sidenavOpened = !this.sidenavOpened;
    }

    updateSelectedNodes() {
        this.selectedNodes = this.networkGraph.getSelectedNodes();
    }

    updateSelectedEdges() {
        this.selectedEdges = this.networkGraph.getSelectedEdges();
    }

    updateSelectedNodesAndEdges() {
        this.updateSelectedNodes();
        this.updateSelectedEdges();
    }

    clearSelectedNodeEdgeLabels() {
        this.selectedNodeEdgeLabels.validLabels.clear();
        this.selectedNodeEdgeLabels.invalidLabels.clear();
    }

    updateSelectedNodeEdgeLabels(selectedNode: IdType) {
        this.clearSelectedNodeEdgeLabels();
        const edgeLabelsResult = this.getConnectedEdgeLabels(selectedNode);
        edgeLabelsResult.validLabels.forEach(label => this.selectedNodeEdgeLabels.validLabels.add(label));
        edgeLabelsResult.invalidLabels.forEach(label => this.selectedNodeEdgeLabels.invalidLabels.add(label));
    }

    collapseNeighbors(***ARANGO_USERNAME***Node: VisNode) {
        // Get all the nodes connected to the ***ARANGO_USERNAME*** node, before removing edges
        const connectedNodes = this.networkGraph.getConnectedNodes(***ARANGO_USERNAME***Node.id) as IdType[];
        (this.networkGraph.getConnectedEdges(***ARANGO_USERNAME***Node.id) as IdType[]).forEach(
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
        const nodeRef: VisNode = this.nodes.get(nodeId);

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
     * output of the function is the input edge + any cluster edges it is contained
     * in if any.
     * @param edge the id of the edge to check
     */
    isNotAClusterEdge(edge: IdType) {
        return typeof edge !== 'string' && this.networkGraph.getClusteredEdges(edge).length === 1;
    }

    /**
     * Gets all the neighbors of the given node connected by the given relationship.
     * @param relationship string representing the connecting relationship
     * @param node id of the ***ARANGO_USERNAME*** node
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
        const clusterNodeCandidates = (this.networkGraph.getConnectedNodes(selectedNode) as IdType[]).filter(
            node => !this.networkGraph.isCluster(node)
        );
        const candidateLabels = new Set<string>();
        const invalidLabels = new Set<string>();
        const validLabels = new Set<string>();

        this.networkGraph.getConnectedEdges(selectedNode).filter(
            edge => this.isNotAClusterEdge(edge)
        ).forEach(
            edge => candidateLabels.add(this.edges.get(edge).label)
        );

        // TODO: Possible performance (both space & time) improvement opportunity here
        // Check that all the depth-2 neighbors of each cluster candidate node is connected to all other
        // candidate nodes. Otherwise we might have nodes connected to the cluster that aren't associated with
        // all of its component nodes
        clusterNodeCandidates.forEach(clusterNodeCandidate => {
            this.networkGraph.getConnectedNodes(clusterNodeCandidate).forEach(nodeConnectedToCandidate => {
                if (!clusterNodeCandidates.every(
                    candidate => (this.networkGraph.getConnectedNodes(nodeConnectedToCandidate) as IdType[]).includes(candidate))
                ) {
                    this.getEdgesBetweenNodes(clusterNodeCandidate, selectedNode).map(
                        edgeId => this.edges.get(edgeId).label
                    ).forEach(
                        invalidLabel => invalidLabels.add(invalidLabel)
                    );
                }
            });
        });

        candidateLabels.forEach(label => {
            if (!invalidLabels.has(label)) {
                validLabels.add(label);
            }
        });

        return {validLabels, invalidLabels} as GetLabelsResult;
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

    /**
     * Creates a cluster node of all the neighbors connected to the currently selected
     * node cnonected by the input relationship.
     * @param rel a string representing the relationship the neighbors will be clustered on
     */
    groupNeighborsWithRelationship(groupRequest: GroupRequest) {
        const { relationship, node} = groupRequest;
        const neighborNodesWithRel = this.getNeighborsWithRelationship(relationship, node);
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
                label: null,
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

    removeNodes(nodes: IdType[]) {
        nodes.forEach(node => {
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
     * Opens the metadata sidebar for with the input node's data
     * TODO: the sidebar isn't implemented yet, so just printing the node data for now.
     * @param referenceTableSelection represents a row in the reference table, contains node data and edge label
     */
    getAssociationsWithEdge(edge: GraphRelationship) {
        this.getSnippets.emit({
                fromNode: edge.from,
                toNode: edge.to,
                association: edge.label,
        } as AssociationData);
    }

    updateSidebarEntity() {
        this.sidenavOpened = true;
        if (this.selectedNodes.length === 1 && this.selectedEdges.length === 0) {
            if (this.networkGraph.isCluster(this.selectedNodes[0])) {
                const cluster = this.selectedNodes[0];
                // TODO: Need a new API endpoint for getting association snippets for many edges at a time
                this.sidenavEntity = {
                    data: null,
                    includes: this.networkGraph.getNodesInCluster(cluster).map(nodeId => this.nodes.get(nodeId)),
                    referencesMap: null
                } as SidenavClusterEntity;
                this.sidenavEntityType = 'cluster';
            } else {
                const node  = this.nodes.get(this.selectedNodes[0]) as VisNode;
                this.sidenavEntity = {
                    data: node,
                    edges: this.networkGraph.getConnectedEdges(node.id).map(edgeId => this.edges.get(edgeId))
                } as SidenavNodeEntity;
                this.sidenavEntityType = 'node';
            }
        } else if (this.selectedNodes.length === 0 && this.selectedEdges.length === 1) {
            const edge = this.edges.get(this.selectedEdges[0]) as GraphRelationship;
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
        this.referenceTableControlService.hideTooltip();
    }

    // Begin Callback Functions

    onClickCallback(params: any) {
        this.hideAllTooltips();
    }

    onDragStartCallback(params: any) {
        this.hideAllTooltips();
        this.updateSelectedNodes(); // Dragging a node doesn't fire node selection, but it is selected after dragging finishes, so update

        if (this.networkGraph.isCluster(params.nodes[0]) || !this.nodes.get(params.nodes[0])) {
            this.referenceTableControlService.interruptReferenceTable();
        }
    }

    onHoverNodeCallback(params: any) {
        if (this.networkGraph.isCluster(params.node)) {
            this.nodesInHoveredCluster = this.networkGraph.getNodesInCluster(params.node).map(
                nodeId => {
                    return {
                        node: this.nodes.get(nodeId),
                        edges: this.networkGraph.getConnectedEdges(nodeId).map(edgeId => this.edges.get(edgeId)),
                    } as ReferenceTableRow;
                }
            );

            this.referenceTableControlService.delayReferenceTable();
            this.referenceTableControlService.showReferenceTableResult$.pipe(
                first(),
                filter(showGroupByRel => showGroupByRel),
            ).subscribe(() => {
                // Update the canvas location
                const clusterPosition = this.networkGraph.getPositions(params.node)[`${params.node}`]; // Cluster x and y
                const clusterDOMPos = this.networkGraph.canvasToDOM(clusterPosition);

                const canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;
                const referenceTableXPos = clusterDOMPos.x + canvas.x;
                const referenceTableYPos = clusterDOMPos.y + canvas.y;

                this.referenceTableControlService.updatePopper(referenceTableXPos, referenceTableYPos);
                this.referenceTableControlService.showTooltip();
            });
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
        if (this.networkGraph.isCluster(params.node) || !this.nodes.get(params.node)) {
            this.referenceTableControlService.interruptReferenceTable();
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
        this.updateSelectedNodes();
        this.updateSidebarEntity();
    }

    onSelectEdgeCallback(params: any) {
        this.updateSelectedEdges();
        this.updateSidebarEntity();
    }

    onDeselectEdgeCallback(params: any) {
        this.updateSelectedEdges();
        this.updateSidebarEntity();
    }

    onDoubleClickCallback(params: any) {
        const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);

        if (this.networkGraph.isCluster(hoveredNode)) {
            this.networkGraph.openCluster(hoveredNode);
            this.clusters.delete(hoveredNode as string);
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
            // Clean up the selected node edge labels even if we selected more than one node, or any edges
            // (this should prevent stale data in the context menu component)
            this.clearSelectedNodeEdgeLabels();
        }
        this.contextMenuControlService.showTooltip();
        this.updateSidebarEntity(); // oncontext does not select the hovered entity by default, so update
      }

      // End Callback Functions
}
