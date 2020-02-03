import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';

import { Network, DataSet, IdType } from 'vis-network';

import { Neo4jGraphConfig, VisNode } from '../../../interfaces';
import { ContextMenuControlService } from '../../services/context-menu-control.service';

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
    providers: [ContextMenuControlService],
})
export class VisualizationCanvasComponent implements OnInit {
    @Output() expandNode = new EventEmitter<number>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;

    networkGraph: Network;
    selectedNodes: IdType[];
    selectedNodeEdgeLabels: Set<string>;
    selectedEdges: IdType[];

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {
        this.selectedNodes = [];
        this.selectedEdges = [];
        this.selectedNodeEdgeLabels = new Set<string>();
    }

    ngOnInit() {
        const container = document.getElementById('network-viz');
        const data = {
            nodes: this.nodes,
            edges: this.edges,
        };
        // TODO KG-17: It seems the network graph automatically updates itself any time
        // this.nodes or this.edges is edited...need to test this out.
        // Likewise, this.nodes/edges are not copied when
        // sent to the context-menu as inputs, so changing them there will change them
        // here.
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
            if (connectedEdges.length == 0) {
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
     * Gets a set of labels from the edges connected to the input node.
     * @param selectedNode the ID of the node whose edge labels we want to get
     */
    getConnectedEdgeLabels(selectedNode: IdType) {
        const connectedEdges = this.networkGraph.getConnectedEdges(selectedNode);
        connectedEdges.forEach((edge) => {
            this.selectedNodeEdgeLabels.add(this.edges.get(edge).label);
        });
    }

    /**
     * Creates a cluster node of all the neighbors connected to the currently selected
     * node cnonected by the input relationship.
     * @param rel a string representing the relationship the neighbors will be clustered on
     */
    groupNeighborsWithRelationship(rel: string) {
        const neighborNodesWithRel = [];
        const connectedEdgesWithRel = [];
        const rootNode = this.selectedNodes[0];

        this.networkGraph.getConnectedEdges(rootNode).filter((edgeId) => {
            return this.edges.get(edgeId).label === rel;
        }).map((connectedEdgeWithRel) => {
            // TODO: Remove these edges from the list
            connectedEdgesWithRel.push(connectedEdgeWithRel);
            const connectedNodes  = this.networkGraph.getConnectedNodes(connectedEdgeWithRel) as IdType[];
            connectedNodes.filter(
                nodeId => nodeId !== rootNode
            ).map(
                // TODO: Remove these nodes from the list
                neighborNodeWithRel => neighborNodesWithRel.push(neighborNodeWithRel)
            );
        });
        this.networkGraph.cluster({
            joinCondition: (node) => neighborNodesWithRel.includes(node.id),
            clusterNodeProperties: {
                // id: 'my-cluster',
                label: rel,
                borderWidth: 3,
                color: 'red',
                shape: 'database'
              }
        });
        // TODO KG-17: Immediately removing nodes seems to also remove the cluster...might be related to the
        // note I left in the visualization.canvas.component regarding updates/deletions of this.nodes/edges.

        // TODO KG-17: Add a new node representing the cluster
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

        // TODO KG-17: These are currently causing new nodes to be created if the hovered node is a cluster.
        // Most likely this is because we don't yet add a new node to the list when the cluster is created,
        // this.networkGraph.on('hoverNode', (params) => {
        //     // This produces an 'enlarge effect'
        //     const node = this.nodes.get(params.node);
        //     const updatedNode = {...node, size: this.config.nodes.size * 1.5};
        //     this.nodes.update(updatedNode);
        // });

        // this.networkGraph.on('blurNode', (params) => {
        //     // This produces a 'shrink effect'
        //     const node = this.nodes.get(params.node);
        //     const updateNode = {...node, size: this.config.nodes.size};
        //     this.nodes.update(updateNode);
        // });

        this.networkGraph.on('doubleClick', (params) => {

            const nodeId = params.nodes[0];
            // Check if event is double clicking a node
            if (nodeId) {
                this.expandOrCollapseNode(nodeId);
            }
        });

        this.networkGraph.on('oncontext', (params) => {
            this.onContextCallback(params);
        });
    }

    onContextCallback(params: any) {
        // Stop the browser from showing the normal context
        params.event.preventDefault();

        // Update the canvas location
        const canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;

        const contextMenuXPos = params.pointer.DOM.x + canvas.x;
        const contextMenuYPos = params.pointer.DOM.y + canvas.y;

        this.contextMenuControlService.updatePopper(contextMenuXPos, contextMenuYPos);

        const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);
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

        this.selectedNodeEdgeLabels.clear();
        if (this.selectedNodes.length === 1) {
            this.getConnectedEdgeLabels(this.selectedNodes[0]);
        }
        this.contextMenuControlService.showContextMenu();
      }

      onClickCallback(params: any) {
        this.contextMenuControlService.hideContextMenu();
      }
}
