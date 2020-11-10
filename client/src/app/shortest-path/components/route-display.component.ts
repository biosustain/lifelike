import { AfterViewInit, Component, Input } from '@angular/core';

import { Network, DataSet } from 'vis-network';

import { uuidv4 } from 'app/shared/utils';
import { Neo4jGraphConfig } from 'app/interfaces';

@Component({
  selector: 'app-route-display',
  templateUrl: './route-display.component.html',
  styleUrls: ['./route-display.component.scss']
})
export class RouteDisplayComponent implements AfterViewInit {

  @Input() edges: any;
  @Input() nodes: any;

  config: Neo4jGraphConfig;
  networkGraph: Network;
  networkContainerId: string;

  constructor() {
    this.networkContainerId = uuidv4();

    this.config = {
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
        },
      },
      edges: {
        font: {
          size: 12,
        },
        widthConstraint: {
          maximum: 90,
        },
      },
      nodes: {
        size: 25,
        shape: 'box',
        // TODO: Investigate the 'scaling' property for dynamic resizing of 'box' shape nodes
      },
    };
  }

  ngAfterViewInit() {
    this.initNetwork();
    this.setNetworkData();
  }

  initNetwork() {
    const container = document.getElementById(this.networkContainerId);
    this.networkGraph = new Network(
      container,
      {
        nodes: new DataSet(this.nodes),
        edges: new DataSet(this.edges),
      },
      this.config);
  }

  setNetworkData() {
    const data = {
      nodes: new DataSet(this.nodes),
      edges: new DataSet(this.edges),
    };
    this.networkGraph.setData(data);
  }
}
