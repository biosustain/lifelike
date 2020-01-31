import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { DataSet, Network, IdType } from 'vis-network';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuControlService } from '../../services/context-menu-control.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
    providers: [ContextMenuControlService],
})
export class VisualizationComponent implements OnInit {
  canvas: DOMRect;
  contextMenuXPos = 0;
  contextMenuYPos = 0;
  networkGraph: Network;
  nodes: DataSet<any, any>;
  edges: DataSet<any, any>;

  selectedNodes: IdType[] = [];
  selectedEdges: IdType[] = [];

  hideContextMenu = false;
  showContextMenu = false;
  popperUpdate = false;

  constructor(
    private visService: VisualizationService,
    private contextMenuControlService: ContextMenuControlService,
  ) {}

  ngOnInit() {
    // #TODO: Notice need to COALESCE the origin node or no connection
    // # TODO: Remove me, don't allow users to perform cypher queries
    const exampleQuery = `
      MATCH p=(r:BiggReaction)-[:PRODUCES]->(m:BiggMetabolite)
      RETURN COALESCE(nodes(p), []) as nodes,
      COALESCE(relationships(p)) as relationships
      LIMIT 10
    `; /* tslint:disable */
    this.visService.query(exampleQuery).subscribe((result: {nodes: any[], edges: any[]}) => {
        this.nodes = new DataSet(result.nodes);
        this.edges = new DataSet(result.edges);

        // create a network
        let container = document.getElementById('network-viz');

        // provide the data in the vis format
        let data = {
            nodes: this.nodes,
            edges: this.edges,
        };

        let options = {
            interaction: {
              multiselect: true,
              selectConnectedEdges: false,
              hover: true,
            },
        };

        // initialize network
        let network = new Network(container, data, options);
        this.networkGraph = network

        this.canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;
        this.setupCanvasEvents();
    });
  }

  /**
   * Sets up the context menu the user sees if they right-click the network canvas.
   */
  setupCanvasEvents() {
    this.networkGraph.on('click', (params) => {
      this.onClickCallback(params);
    });

    this.networkGraph.on('oncontext', (params) => {
      this.onContextCallback(params);
    });

    // this.networkGraph.on("hoverNode", function(params) {
    //   if (this.isCluster(params.node) == true) {
    //     console.log('hovered node is a cluster!')
    //   } else {
    //     console.log('hovered node is not a cluster!')
    //   }
    // });
  }

  onContextCallback(params: any) {
    // Stop the browser from showing the normal context
    params.event.preventDefault();

    // Update the canvas location
    this.canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;

    this.contextMenuXPos = params['pointer']['DOM']['x'] + this.canvas.x;
    this.contextMenuYPos = params['pointer']['DOM']['y'] + this.canvas.y;

    this.contextMenuControlService.updatePopper(this.contextMenuXPos, this.contextMenuYPos);

    const hoveredNode = this.networkGraph.getNodeAt(params.pointer.DOM);
    const hoveredEdge = this.networkGraph.getEdgeAt(params.pointer.DOM);
    this.selectedNodes = this.networkGraph.getSelectedNodes();
    this.selectedEdges = this.networkGraph.getSelectedEdges();

    if (hoveredNode !== undefined) {
      if (!this.selectedNodes.includes(hoveredNode)) {
        this.networkGraph.unselectAll()
        this.selectedNodes = [hoveredNode];
        this.networkGraph.selectNodes(this.selectedNodes);
      }
    } else if (hoveredEdge !== undefined) {
      if (!this.selectedEdges.includes(hoveredEdge)) {
        this.networkGraph.unselectAll()
        this.selectedEdges = [hoveredEdge];
        this.networkGraph.selectEdges(this.selectedEdges);
      }
    } else {
      this.networkGraph.unselectAll()
      this.selectedNodes = [];
      this.selectedEdges = [];
    }
    this.contextMenuControlService.showContextMenu()
  }

  onClickCallback(params: any) {
    this.contextMenuControlService.hideContextMenu();
  }
}
