import {
    Component,
    Input,
    EventEmitter,
    OnChanges,
    OnInit,
    Output,
} from '@angular/core';
import { Neo4jGraphConfig } from '../../../interfaces';
import { Network, DataSet, IdType } from 'vis-network';
import { ContextMenuControlService } from '../../services/context-menu-control.service';

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
    providers: [ContextMenuControlService],
})
export class VisualizationCanvasComponent implements OnInit {
    @Output() expandAndCollapseNodeId = new EventEmitter<{nodeId: number, edgeIds: Array<number>}>();

    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;

    networkGraph: Network;
    selectedNodes: IdType[] = [];
    selectedEdges: IdType[] = [];

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {}

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

    /**
     * Contains all of the event handling features for the
     * network graph.
     */
    visualizerSetupEventBinds() {
        this.networkGraph.on('click', (params) => {
            this.onClickCallback(params);
        });

        this.networkGraph.on('hoverNode', (params) => {
            // This produces an 'enlarge effect'
            const node = this.nodes.get(params.node);
            const updatedNode = {...node, size: this.config.nodes.size * 1.5};
            this.nodes.update(updatedNode);
        });

        this.networkGraph.on('blurNode', (params) => {
            // This produces a 'shrink effect'
            const node = this.nodes.get(params.node);
            const updateNode = {...node, size: this.config.nodes.size};
            this.nodes.update(updateNode);
        });

        this.networkGraph.on('doubleClick', (params) => {

            const nodeId = params.nodes[0];
            const edgeIds = params.edges;
            // Check if event is double clicking a node
            if (nodeId) {
                this.expandAndCollapseNodeId.emit({ nodeId, edgeIds });
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
          this.selectedNodes = [];
          this.selectedEdges = [];
        }
        this.contextMenuControlService.showContextMenu();
      }

      onClickCallback(params: any) {
        this.contextMenuControlService.hideContextMenu();
      }
}
