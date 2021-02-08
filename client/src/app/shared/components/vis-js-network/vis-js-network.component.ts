import { AfterViewInit, Component, Input } from '@angular/core';

import { isNullOrUndefined } from 'util';

import { Network } from 'vis-network';

import { uuidv4 } from 'app/shared/utils';
import { Neo4jGraphConfig } from 'app/interfaces';


enum networkSolvers {
  BARNES_HUT = 'barnesHut',
  FORCE_ATLAS_2_BASED = 'forceAtlas2Based',
  HIERARCHICHAL_REPULSION = 'hierarchicalRepulsion',
  REPULSION = 'repulsion'
}

@Component({
  selector: 'app-vis-js-network',
  templateUrl: './vis-js-network.component.html',
  styleUrls: ['./vis-js-network.component.scss']
})
export class VisJsNetworkComponent implements AfterViewInit {
  @Input() set config(config: Neo4jGraphConfig) {
    this.networkConfig = config;

    if (!isNullOrUndefined(config.physics)) {
      this.currentSolver = this.solverMap.get(config.physics.solver || networkSolvers.BARNES_HUT);
      this.physicsEnabled = config.physics.enabled || true;
    } else {
      this.currentSolver = this.solverMap.get(networkSolvers.BARNES_HUT);
      this.physicsEnabled = true;
    }

    if (!isNullOrUndefined(this.networkGraph)) {
      this.createNetwork();
    }

  }
  @Input() set data(data: any) {
    this.networkData = data;
    if (!isNullOrUndefined(this.networkGraph)) {
      this.setNetworkData();
    }
  }
  @Input() legend: Map<string, string[]>;

  SCALE_MODIFIER = 0.11;

  networkConfig: Neo4jGraphConfig;
  networkData: any;
  networkGraph: Network;
  networkContainerId: string;

  stabilized: boolean;
  physicsEnabled: boolean;

  currentSolver: string;
  solverMap: Map<string, string>;

  cursorStyle: string;

  constructor() {
    this.networkContainerId = uuidv4();
    this.stabilized = false;
    this.setupSolverMap();
    this.currentSolver = this.solverMap.get(networkSolvers.BARNES_HUT);
    this.physicsEnabled = true;
    this.cursorStyle = 'default';
    this.legend = new Map<string, string[]>();
  }

  ngAfterViewInit() {
    this.createNetwork();
  }

  /**
   * Defines solverMap Map object, where the keys are Vis.js accepted solver types, and the values are UI appropriate strings.
   */
  setupSolverMap() {
    this.solverMap = new Map<string, string>();
    this.solverMap.set(networkSolvers.BARNES_HUT, 'Barnes Hut');
    this.solverMap.set(networkSolvers.FORCE_ATLAS_2_BASED, 'Force Atlas');
    // Disabling this for now, as it seems to require additional configuration that we cannot assume will be present.
    // this.solverMap.set(networkSolvers.HIERARCHICHAL_REPULSION, 'Hierarchical Repulsion');
    this.solverMap.set(networkSolvers.REPULSION, 'Repulsion');
  }

  setNetworkData() {
    this.networkGraph.setData(this.networkData);
  }

  /**
   * Creates the Vis.js network. Also sets up event callbacks. Should be called after the view is initialized, otherwise the network
   * container may not exist.
   */
  createNetwork() {
    const container = document.getElementById(this.networkContainerId);

    this.stabilized = false;
    this.networkGraph = new Network(
      container,
      this.networkData,
      this.networkConfig
    );
    this.setupEventBinds();
    this.networkGraph.stabilize(500);
  }

  fitToNetwork() {
    this.networkGraph.fit();
  }

  zoomIn() {
    this.networkGraph.moveTo({
      scale: this.networkGraph.getScale() + this.SCALE_MODIFIER,
    });
  }

  zoomOut() {
    this.networkGraph.moveTo({
      scale: this.networkGraph.getScale() - this.SCALE_MODIFIER,
    });
  }

  togglePhysics() {
    this.physicsEnabled = !this.physicsEnabled;
    this.networkGraph.setOptions({
      physics: {
        ...this.networkConfig.physics,
        enabled: this.physicsEnabled
      },
    });
  }

  /**
   * Udates the Vis.js to use the provided layout solver. Also updates the currently selected solver, which is reflected in the UI.
   * @param layoutType string representing the newly selected layout solver, expected to be one of networkSolvers
   */
  updateNetworkLayout(layoutType: string) {
    this.physicsEnabled = true;
    this.networkConfig = {
      ...this.networkConfig,
      physics: {
        enabled: this.physicsEnabled,
        solver: layoutType,
      }
    };
    this.currentSolver = this.solverMap.get(layoutType);
    this.createNetwork();
  }

  /**
   * Contains all of the event handling features for the
   * network graph.
   */
  setupEventBinds() {
    this.networkGraph.on('stabilizationIterationsDone', (params) => {
      this.stabilized = true;
      this.networkGraph.fit();
    });

    this.networkGraph.on('dragStart', (params) => {
      this.cursorStyle = params.nodes.length > 0 ? 'grabbing' : 'move';
    });

    this.networkGraph.on('dragEnd', (params) => {
      this.cursorStyle = 'default';
    });

  }
}
