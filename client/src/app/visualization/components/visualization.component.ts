import { Component, OnInit } from '@angular/core';
import { createPopper } from '@popperjs/core';

import { DataSet, Edge, Network } from 'vis-network';
import { VisualizationService } from '../services/visualization.service';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    networkGraph: Network;
    nodes: DataSet<any, any>;
    edges: DataSet<any, any>;

    constructor(private visService: VisualizationService) {}

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
                // This will disable the bouncing
                physics: {
                    enabled: false,
                },
                interaction: {
                  multiselect: true,
                  selectConnectedEdges: false,
                },
            };

            // initialize network
            let network = new Network(container, data, options);
            this.networkGraph = network

            this.setupContextMenu();
        });
    }

    /**
     * Sets up the context menu the user sees if they right-click the network canvas.
     */
    setupContextMenu() {
      function generateRect(x = 0, y = 0) {
        return () => ({
          width: 0,
          height: 0,
          top: y,
          right: x,
          bottom: y,
          left: x,
        });
      }

      const virtualElement = {
        getBoundingClientRect: generateRect(),
      };
      const tooltip = <HTMLElement>document.querySelector('#tooltip');
      const instance = createPopper(virtualElement, tooltip, {
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 0],
            },
          },
        ],
        placement: 'right-start',
      });

      this.networkGraph.on('click', function() {
        tooltip.style.display = 'none'
      });

      this.networkGraph.on('oncontext', function(params) {
        // Stop the browser from showing the normal context
        params.event.preventDefault();

        tooltip.style.display = 'flex'

        const canvas = document.querySelector('canvas').getBoundingClientRect();

        const domX = params['pointer']['DOM']['x'] + canvas.x;
        const domY = params['pointer']['DOM']['y'] + canvas.y;

        virtualElement.getBoundingClientRect = generateRect(domX, domY);
        instance.update();

        const hoveredNode: number = this.getNodeAt(params.pointer.DOM);
        const hoveredEdge: number = this.getEdgeAt(params.pointer.DOM);
        let selectedNodes: Array<number> = this.getSelectedNodes();
        let selectedEdges: Array<number>  = this.getSelectedEdges();

        if (hoveredNode !== undefined) {
          if (!selectedNodes.includes(hoveredNode)) {
            this.unselectAll()
            selectedNodes = [hoveredNode];
            this.selectNodes(selectedNodes);
          }
        } else if (hoveredEdge !== undefined) {
          if (!selectedEdges.includes(hoveredEdge)) {
            this.unselectAll()
            selectedEdges = [hoveredEdge];
            this.selectNodes(selectedEdges);
          }
        } else {
          this.unselectAll()
          console.log('open default context menu');
          return
        }
        console.log('open selected entity context menu')
      });
    }
}
