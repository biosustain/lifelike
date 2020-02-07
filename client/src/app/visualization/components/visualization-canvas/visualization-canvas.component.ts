import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';

import { Options } from '@popperjs/core';

import { Network, DataSet, IdType } from 'vis-network';

import { Neo4jGraphConfig, VisNode, ReferenceTableRow, AssociationData } from 'app/interfaces';
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
    @Output() getSentences = new EventEmitter<AssociationData>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;
    // TODO KG-17: Can re-enable later, when we decide what to do with the legend
    // @Input() legend: Map<string, string[]>;

    networkGraph: Network;
    selectedNodes: IdType[];
    selectedNodeEdgeLabels: Set<string>;
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
        this.selectedNodes = [];
        this.selectedEdges = [];
        this.selectedNodeEdgeLabels = new Set<string>();
        this.nodesInHoveredCluster = [];

        this.contextMenuTooltipSelector = '#***ARANGO_USERNAME***-menu';
        this.contextMenuTooltipOptions = {
            placement: 'right-start',
        };

        this.referenceTableTooltipSelector = '#reference-table';
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
     * Gets a set of labels from the edges connected to the input node.
     * @param selectedNode the ID of the node whose edge labels we want to get
     */
    getConnectedEdgeLabels(selectedNode: IdType) {
        this.selectedNodeEdgeLabels.clear();
        const connectedEdges = this.networkGraph.getConnectedEdges(selectedNode);
        connectedEdges.forEach((edge) => {
            if (this.isNotAClusterEdge(edge)) {
                this.selectedNodeEdgeLabels.add(this.edges.get(edge).label);
            }
        });
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
    groupNeighborsWithRelationship(rel: string) {
        // NOTE KG-17: It looks like vis.js does not create clusters of single nodes.
        const ***ARANGO_USERNAME***Node = this.selectedNodes[0];
        const connectedEdgesWithRel = this.networkGraph.getConnectedEdges(***ARANGO_USERNAME***Node).filter(
            (edgeId) => this.isNotAClusterEdge(edgeId) && this.edges.get(edgeId).label === rel
        );
        const neighborNodesWithRel = connectedEdgesWithRel.map(
            connectedEdgeWithRel => (this.networkGraph.getConnectedNodes(connectedEdgeWithRel) as IdType[]).filter(
                nodeId => nodeId !== ***ARANGO_USERNAME***Node
            )[0]
        );

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

        this.networkGraph.cluster({
            joinCondition: (node) => neighborNodesWithRel.includes(node.id),
            clusterNodeProperties: {
                image: url,
                label: null,
                shape: 'image',
                size: this.config.nodes.size * 4.5,
                // This setting is valid as described under 'clusterNodeProperties'
                // here: https://visjs.github.io/vis-network/docs/network/index.html#optionsObject
                // @ts-ignore
                allowSingleNodeCluster: true,
            },
            processProperties: (clusterOptions) => {
                const newClusterId = `cluster:${uuidv4()}`;
                this.clusters.set(newClusterId, rel);
                return {...clusterOptions, id: newClusterId};
            }
        });
    }

    /**
     * Opens the metadata sidebar for with the input node's data
     * TODO: the sidebar isn't implemented yet, so just printing the node data for now.
     * @param nodeRef represents a row in the reference table, contains node data
     */
    openMetadataSidebar(nodeRef: ReferenceTableRow) {
        const clusterId = this.networkGraph.findNode(nodeRef.nodeId)[0] as string;
        const clusteredRelationship = this.clusters.get(clusterId);
        const relatedTo = this.nodes.get(this.networkGraph.getConnectedNodes(clusterId)[0] as number).displayName;
        this.getSentences.emit({
                nodeId: nodeRef.nodeId,
                entryText: relatedTo,
                description: clusteredRelationship,
        } as AssociationData);
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
    }

    onHoverNodeCallback(params: any) {
        if (this.networkGraph.isCluster(params.node)) {
            this.nodesInHoveredCluster = this.networkGraph.getNodesInCluster(params.node).map(
                nodeId => {
                    return {displayName: this.nodes.get(nodeId).displayName, nodeId: nodeId as number};
                }
            );

            // Update the canvas location
            const canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;
            const contextMenuXPos = params.pointer.DOM.x + canvas.x;
            const contextMenuYPos = params.pointer.DOM.y + canvas.y;

            this.referenceTableControlService.updatePopper(contextMenuXPos, contextMenuYPos);
            this.referenceTableControlService.showTooltip();
            return;
        } else if (!this.nodes.get(params.node)) {
            return;
        }

        // This produces an 'enlarge effect'
        const node = this.nodes.get(params.node);
        const updatedNode = {...node, size: this.config.nodes.size * 1.5};
        this.nodes.update(updatedNode);
    }

    onBlurNodeCallback(params: any) {
        if (this.networkGraph.isCluster(params.node) || !this.nodes.get(params.node)) {
            return;
        }

        // This produces a 'shrink effect'
        const node = this.nodes.get(params.node);
        const updateNode = {...node, size: this.config.nodes.size};
        this.nodes.update(updateNode);
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
        this.selectedNodeEdgeLabels.clear();

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
        this.selectedNodes = this.networkGraph.getSelectedNodes();
        this.selectedEdges = this.networkGraph.getSelectedEdges();

        if (hoveredNode !== undefined) {
            if (!this.selectedNodes.includes(hoveredNode)) {
                this.networkGraph.unselectAll();
                this.selectedNodes = [hoveredNode];
                this.networkGraph.selectNodes(this.selectedNodes);
            }
        } else if (hoveredEdge !== undefined) {
            if (!this.selectedEdges.includes(hoveredEdge)) {
                this.networkGraph.unselectAll();
                this.selectedEdges = [hoveredEdge];
                this.networkGraph.selectEdges(this.selectedEdges);
            }
        } else {
            this.networkGraph.unselectAll();
        }

        if (this.selectedNodes.length === 1) {
            this.getConnectedEdgeLabels(this.selectedNodes[0]);
        }
        this.contextMenuControlService.showTooltip();
      }

      // End Callback Functions
}
