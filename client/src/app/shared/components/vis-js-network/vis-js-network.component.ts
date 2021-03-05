import { AfterViewInit, Component, Input } from '@angular/core';

import { isNullOrUndefined } from 'util';

import { DataSet } from 'vis-data';
import { Color, Edge, Network, Node, Options } from 'vis-network';

import { GraphData, VisNetworkDataSet } from 'app/interfaces/vis-js.interface';
import { uuidv4 } from 'app/shared/utils';


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
  @Input() set config(config: Options) {
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
  @Input() set data(data: GraphData) {
    this.networkData.nodes.update(data.nodes);
    this.networkData.edges.update(data.edges);
    if (!isNullOrUndefined(this.networkGraph)) {
      this.setNetworkData();
    }
  }
  @Input() legend: Map<string, string[]>;

  SCALE_MODIFIER = 0.11;

  networkConfig: Options;
  networkData: VisNetworkDataSet;
  networkGraph: Network;
  networkContainerId: string;

  stabilized: boolean;
  physicsEnabled: boolean;

  solverMap: Map<string, string>;
  currentSolver: string;

  currentSearchIndex: number;
  searchResults: Node[];
  searchQuery: string;

  cursorStyle: string;

  constructor() {
    this.legend = new Map<string, string[]>();

    this.networkConfig = {};
    this.networkData = {
      nodes: new DataSet<Node, 'id'>(),
      edges: new DataSet<Edge, 'id'>(),
    };
    this.networkContainerId = uuidv4();

    this.stabilized = false;
    this.physicsEnabled = true;

    this.setupSolverMap();
    this.currentSolver = this.solverMap.get(networkSolvers.BARNES_HUT);

    this.currentSearchIndex = 0;
    this.searchResults = [];
    this.searchQuery = '';

    this.cursorStyle = 'default';
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

  /**
   * Resets the network data. Be careful using this method! It will cause the network to be re-drawn and stabilized, and is therefore
   * rather slow. If there isn't a need to reset the entire network, it is better to use the DataSet update method for nodes and edges.
   */
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
   * Udates the Vis.js network to use the provided layout solver. Also updates the currently selected solver, which is reflected in the UI.
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
   * Finds all nodes which contain the given substring in their label and returns copies of these nodes. Returning copies ensures we do not
   * accidentally mutate the data.
   * @param query string to search for in all nodes
   */
  searchNodesWithQuery(query: string): Node[] {
    return this.networkData.nodes.get()
      .filter(
        node => (node.label as string).toLowerCase().includes(query.toLowerCase())
      ).map(node => {
        return {...node};
      });
  }

  searchQueryChanged() {
    // Need to revert the previous search results back to their original values
    if (this.searchResults.length > 0) {
      this.searchResults.forEach(node => {
        this.networkData.nodes.update({
          ...node,
          borderWidth: 1,
        });
      });
    }

    this.searchResults = [];

    if (this.searchQuery !== '') {
      this.searchResults = this.searchNodesWithQuery(this.searchQuery);

      // Set the index to -1, since we call `findNext` immediately after this function is called and want the index to be 0
      this.currentSearchIndex = -1;
      this.searchResults.forEach(node => this.highlightNode(node.id));
    }
  }

  findNext() {
    if (this.searchResults.length > 0) {
      // If we're about to go beyond the search result total, wrap back to the beginning
      if (this.currentSearchIndex + 1 === this.searchResults.length) {
        this.currentSearchIndex = 0;
      } else {
        this.currentSearchIndex += 1;
      }
      this.focusNode(this.searchResults[this.currentSearchIndex].id);
    }
  }

  findPrevious() {
    if (this.searchResults.length > 0) {
      // If we're about to reach negative indeces, then wrap to the end
      if (this.currentSearchIndex - 1 === -1) {
        this.currentSearchIndex = this.searchResults.length - 1;
      } else {
        this.currentSearchIndex -= 1;
      }
      this.focusNode(this.searchResults[this.currentSearchIndex].id);
    }
  }

  focusNode(nodeId: number | string) {
    this.networkGraph.focus(nodeId);
    // Zoom in on the focused node, otherwise it might be hard to find
    this.networkGraph.moveTo({
      scale: 0.99,
    });
  }

  highlightNode(nodeId: number | string) {
    const nodeToHighlight = this.networkData.nodes.get(nodeId);
    const nodeColor = (nodeToHighlight.color as Color);
    nodeToHighlight.borderWidth = 2;
    nodeToHighlight.color = {
      ...nodeColor,
      border: 'red'
    } as Color;
    this.networkData.nodes.update(nodeToHighlight);
  }

  /**
   * Contains all of the event handling features for the network graph.
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
