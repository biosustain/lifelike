import {
  uuidv4
} from './services';
import {
  VisNetworkGraphNode,
  GraphSelectionData,
  VisNetworkGraphEdge
} from './services/interfaces';
import { Network, Options, DataSet } from 'vis-network';
import { visJsGroupStyleFactory } from '../shared/annotation-styles';

/**
 * A class wrapped around the instatiation of
 * vis.js Network Graph visualization
 */
export class NetworkVis {
  /** The DOM container to inject HTML5 canvas in */
  container = null;

  // Visual layer through vis.js dataset collection
  visNodes = null;
  visEdges = null;

  /**  */
  network: Network = null;

  /** Rendering options for network graph */
  options = {
    interaction: {
      hover: true,
      multiselect: true,
      dragNodes: true
    },
    edges: {
      color: {
        color: '#2B7CE9'
      },
      arrows: {
        to: {
          enabled: true
        }
      },
      physics: false,
      smooth: {
        enabled: false
      }
    },
    nodes: {
      shape: 'box',
      physics: false
    },
    groups: {},
    layout: {
      randomSeed: 1
    }
  };

  /**
   *
   * @param HTMLElement container -
   * @param dragNodes - whether or not to allow nodes dragging
   * The container DOM to inject graph in
   */
  constructor(container: HTMLElement, dragNodes: boolean = true) {
    this.container = container;

    // Pull in node template styling defs
    // And assign to vis network js styling
    this.options.groups = visJsGroupStyleFactory();

    this.options.interaction.dragNodes = dragNodes;
  }

  /**
   * Set viewport so that all nodes are visibile on canvas
   */
  zoom2All() {
    this.network.fit({
      nodes: [],
      animation: {
        duration: 400,
        easingFunction: 'easeInOutQuad'
      }
    });
  }

  /**
   * Draw network graph on canvas in container
   * with edges and nodes specified
   * @param nodes array of nodes
   * @param edges array of edges
   */
  draw(nodes = [], edges = []) {
    this.visNodes = new DataSet(nodes);
    this.visEdges = new DataSet(edges);

    // provide the data in the visjs format
    const data = {
      nodes: this.visNodes,
      edges: this.visEdges
    };

    // initialize your network!
    this.network = new Network(
      this.container,
      data,
      this.options as Options
    );

    this.zoom2All();
  }

  /**
   * Add edge to network graph
   * @param sourceId id of the source node
   * @param targetId id of the target node
   * @param label string representing the edge label
   */
  addEdge(sourceId, targetId, label = '') {
    const e = {
      label,
      from: sourceId,
      to: targetId,
      id: uuidv4()
    };

    this.visEdges.add([e]);

    return e;
  }

  /**
   * Remove edge from network graph
   * @param id - id edge of edge to remove by
   */
  removeEdge(id) {
    this.visEdges.remove(id);
  }

  /**
   * Update edge of network graph
   * @param id - id of the edge you want to update
   * @param data - it's updated properties
   */
  updateEdge(id, data) {

    this.visEdges.update({
      id,
      ...data
    });
  }

  /**
   * Add node with initial data to network graph
   * at specific coordinate
   * @param data object representing node data
   * @param x x-coord of the node
   * @param y y-coord of the node
   */
  addNode(data = null, x = 10, y = 10): VisNetworkGraphNode {

    const n = {
      ...data
    };

    // Handle values for attribute that might be missing
    n.id = n.id || uuidv4();
    n.x = n.x || x;
    n.y = n.y || y;
    n.size = 5;
    n.widthConstraint = {
        maximum: 600,
    };
    n.data = {
      source: n.source || '',
      detail: n.detail || '',
      search: n.search || [],
      hyperlink: n.hyperlink || '',
      subtype: n.subtype || '',
      hyperlinks: n.hyperlinks || []
    };

    this.visNodes.add([n]);

    return n;
  }

  /**
   * Remove node from network graph along with
   * edges it connected to by its id
   * @param id represents the node id
   */
  removeNode(id) {
    this.visNodes.remove(id);

    // Pull the id of edges that node id
    // was connected to
    const connectedEdges = this.visEdges.get({
      filter: (item) => {
        return item.from === id || item.to === id;
      }
    });

    // Remove them from collection ...
    this.visEdges.remove(connectedEdges);
  }

  /**
   * Update a node by it's id and data
   * @param id represents the node id
   * @param data represents the data of the node
   */
  updateNode(id, data) {
    let updatedNode: any = {
        id,
        label: data.label,
        group: data.group,
        data: data.data,
        icon: data.icon,
        shape: data.shape,
    };

    updatedNode = Object.assign({}, updatedNode);

    this.visNodes.update(updatedNode);
  }

  /**
   * Return a node and it's properties, edges, and all
   * other nodes
   * @param id - id of the node you want to info on
   */
  getNode(id): GraphSelectionData {
    const node = this.visNodes.get(id);
    const edges = this.visEdges.get({
      filter: (item) => {
        return item.from === id;
      }
    });

    const nodeData = {
      id: node.id,
      shape: node.shape,
      group: node.group,
      label: node.label,
      edges,
      data: node.data
    };
    const otherNodes = this.visNodes.get({
      filter: (item) => {
        return item.id !== id;
      }
    });

    return {
      nodeData,
      otherNodes
    };
  }

  /**
   * Return an edge's detail by it's id
   * @param id represents an edge id
   */
  getEdge(id) {
    const edgeData = this.visEdges.get(id);

    return {
      edgeData
    };
  }

  /**
   * Return JSON representation of network graph
   */
  export(): {edges: any[], nodes: any[]} {
    const nodePosDict = this.network.getPositions();

    return {
      nodes: this.visNodes.get().map(n => {
        n.x = nodePosDict[n.id].x;
        n.y = nodePosDict[n.id].y;

        return n;
      }).filter(e => e.id !== 'EDGE_FORMATION_DRAGGING'),
      edges: this.visEdges.get().filter(
        e => e.to !== 'EDGE_FORMATION_DRAGGING'
      )
    };
  }

  /**
   * Draw network graph from JSON representation
   */
  import(graph: {nodes: any[], edges: any[]}) {
    this.visNodes = new DataSet(graph.nodes);
    this.visEdges = new DataSet(graph.edges);

    this.network.setData({
      nodes: this.visNodes,
      edges: this.visEdges
    });

    this.network.redraw();
  }
}
