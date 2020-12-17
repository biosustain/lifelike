import { AfterViewInit, Component, Input } from '@angular/core';

import { isNullOrUndefined } from 'util';

import { Network } from 'vis-network';

import { uuidv4 } from 'app/shared/utils';
import { Neo4jGraphConfig } from 'app/interfaces';

@Component({
  selector: 'app-vis-js-network',
  templateUrl: './vis-js-network.component.html',
  styleUrls: ['./vis-js-network.component.scss']
})
export class VisJsNetworkComponent implements AfterViewInit {
  @Input() config: Neo4jGraphConfig;
  @Input() set data(data: any) {
    this.networkData = data;
    if (!isNullOrUndefined(this.networkGraph)) {
      this.setNetworkData();
    }
  }

  networkData: any;
  networkGraph: Network;
  networkContainerId: string;

  stabilized: boolean;

  constructor() {
    this.networkContainerId = uuidv4();
    this.stabilized = false;
  }

  ngAfterViewInit() {
    const container = document.getElementById(this.networkContainerId);
    this.networkGraph = new Network(
      container,
      this.networkData,
      this.config
    );
    this.setupEventBinds();
    this.networkGraph.stabilize(500);
  }

  setNetworkData() {
    this.networkGraph.setData(this.networkData);
  }

    /**
     * Contains all of the event handling features for the
     * network graph.
     */
    setupEventBinds() {
      this.networkGraph.on('startStabilizing', (params) => {
        this.stabilized = false;
      });

      this.networkGraph.on('stabilizationIterationsDone', (params) => {
        this.stabilized  = true;
        this.networkGraph.fit();
      });
  }
}
