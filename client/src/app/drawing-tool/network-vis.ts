import {
  node_templates,
  uuidv4
} from './services';
import { VisNetworkGraphNode } from './services/interfaces';

declare var vis: any;

/**
 * A class wrapped around the instatiation of
 * vis.js Network Graph visualization
 */
export class NetworkVis {
  /** The DOM container to inject HTML5 canvas in */
  container = null;
  /** vis.js Dataset collection of nodes */
  vis_nodes = null;
  /** vis.js Dataset collection of edges */
  vis_edges = null;
  /**  */
  network = null;

  /** Rendering options for network graph */
  options = {
    interaction: {
      hover: true
    },
    edges: {
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
  }

  /**
   * @param {HTMLElement} container - 
   * The container DOM to inject graph in 
   */
  constructor(container) {
    this.container = container;

    // Pull in node template styling defs
     const group_styling = {};
     for (let n_t of node_templates) {
       group_styling[n_t.label] = {
         borderWidth: 0,
         color: {
           background: n_t.color
         },
         font: {
           color: '#fff'
         }
       }
     }
     // And assign to vis network js styling
     this.options.groups = group_styling;
  }

  /**
   * Set viewport so that all nodes are visibile on canvas
   */
  zoom2All() {
    this.network.fit({
      nodes: [],
      animation: false
    })
  }

  /**
   * Draw network graph on canvas in container
   * with edges and nodes specified
   * @param nodes 
   * @param edges 
   */
  draw(
    nodes=[],
    edges=[]
  ) {
    // create an array with nodes
    this.vis_nodes = new vis.DataSet(nodes);
    // create an array with edges
    this.vis_edges = new vis.DataSet(edges);

    // provide the data in the visjs format
    var data = {
      nodes: this.vis_nodes,
      edges: this.vis_edges
    };

    // initialize your network!
    this.network = new vis.Network(
      this.container,
      data,
      this.options
    );

    this.zoom2All();
  }

  /**
   * Add edge to network graph
   * @param source_id 
   * @param target_id 
   * @param label 
   */
  addEdge(source_id, target_id, label='') {
    var e = {
      label: label,
      from: source_id,
      to: target_id,
      id: uuidv4()
    };
    
    this.vis_edges.add([e]);
    
    return e;
  }

  /**
   * Remove edge from network graph
   * @param id - id edge of edge to remove by
   */
  removeEdge(id) {
    this.vis_edges.remove(id);
  }

  /**
   * Update edge of network graph
   * @param id - id of the edge you want to update
   * @param data - it's updated properties
   */
  updateEdge(id, data) {

    this.vis_edges.update({
      id: id,
      ...data
    });
  }
  
  /**
   * Add node with initial data to network graph
   * at specific coordinate
   * @param data 
   * @param x 
   * @param y 
   */
  addNode(data={}, x=10, y=10): VisNetworkGraphNode {

    var n = {
      ...data
    };

    // Handle values for attribute that might be missing
    n['id'] = n['id'] || uuidv4();
    n['x'] = n['x'] || x;
    n['y'] = n['y'] || y;
    n['size'] = 5;
    n['data'] = {
      'hyperlink': n['hyperlink'] || ''
    }
    
    var updated = this.vis_nodes.add([n]);
    
    return n;
  }

  /**
   * Remove node from network graph along with
   * edges it connected to by its id
   * @param id 
   */
  removeNode(id) {
    this.vis_nodes.remove(id);

    // Pull the id of edges that node id
    // was connected to
    let connectedEdges = this.vis_edges.get({
      filter: (item) => {
        return item.from === id || item.to === id;
      }
    });

    // Remove them from collection ...
    this.vis_edges.remove(connectedEdges);
  }

  /**
   * Update a node by it's id and data
   * @param id 
   * @param data 
   */
  updateNode(id, data) {
    this.vis_nodes.update({
      id: id,
      label: data['label'],
      group: data['group'],
      data: data['data']
    });
  }

  /**
   * Return a node and it's properties, edges, and all
   * other nodes
   * @param id - id of the node you want to info on
   */
  getNode(id) {
    var node = this.vis_nodes.get(id);
    var edges = this.vis_edges.get({
      filter: (item) => {
        return item.from === id;
      }
    });

    var node_data = {
      id: node.id,
      group: node.group,
      label: node.label,
      edges: edges,
      data: node.data
    };
    var other_nodes = this.vis_nodes.get({
      filter: (item) => {
        return item.id !== id;
      }
    });
    
    console.log(node);

    return {
      node_data,
      other_nodes
    };
  }

  /**
   * Return an edge's detail by it's id
   * @param id 
   */
  getEdge(id) {
    var edge_data = this.vis_edges.get(id);

    return {
      edge_data
    };
  }

  /**
   * Return JSON representation of network graph
   */
  export() {
    let nodePosDict = this.network.getPositions();

    return {
      "nodes": this.vis_nodes.get().map(n => {
        n.x = nodePosDict[n.id].x;
        n.y = nodePosDict[n.id].y;

        return n;
      }).filter(e => e['id'] !== "EDGE_FORMATION_DRAGGING"),
      "edges": this.vis_edges.get().filter(
        e => e['to'] !== "EDGE_FORMATION_DRAGGING"
      )
    }
  }

  /**
   * Draw network graph from JSON representation
   */
  import(graph: {nodes: any[], edges: any[]}) {
    this.vis_nodes = new vis.DataSet(graph.nodes);
    this.vis_edges = new vis.DataSet(graph.edges);

    this.network.setData({
      nodes: this.vis_nodes,
      edges: this.vis_edges
    });

    this.network.redraw()
  }
}
