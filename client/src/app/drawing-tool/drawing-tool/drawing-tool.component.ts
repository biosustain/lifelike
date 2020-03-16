import { 
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  HostListener
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  Subscription, Observable
} from 'rxjs';

import {
  DataFlowService,
  ProjectsService,
  node_templates,
  makeid
} from '../services';
import {
  Project,
  VisNetworkGraphEdge,
  VisNetworkGraphNode
} from '../services/interfaces';
import {
  NetworkVis
} from '../network-vis';

declare var $: any;

interface Update {
  event: string,
  type: string,
  data: Object|string|number
}
interface Graph {
  edges: VisNetworkGraphEdge[],
  nodes: VisNetworkGraphNode[]
}
interface Command {
  action: string,
  data: {
    id?: string,
    label?: string,
    group?: string,
    coord?: {
      x: number,
      y: number
    },
    node?: VisNetworkGraphNode,
    edges?: VisNetworkGraphEdge[],
    edge?: VisNetworkGraphEdge
  }
}

export interface Action {
  cmd: string;
  graph: Graph;
}

@Component({
selector: 'app-drawing-tool',
templateUrl: './drawing-tool.component.html',
styleUrls: ['./drawing-tool.component.scss']
})
export class DrawingToolComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    return this.saveState ? true : confirm('WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.');
  }

  /** The current graph representation on canvas */
  currentGraphState: {edges: any[], nodes: any[]} = null;

  undoStack: Action[] = [];
  redoStack: Action[] = [];

  /** Obj representation of knowledge model with metadata */
  project: Project = null;
  /** vis.js network graph DOM instantiation */
  visjsNetworkGraph = null;
  /** Whether or not graph is saved from modification */
  saveState: boolean = true;

  /** Render condition for dragging gesture of edge formation */
  addMode: boolean = false;
  /** Node part of draggign gesture for edge formation  */
  node4AddingEdge2: string;

  /** Build the palette ui with node templates defined */
  nodeTemplates = node_templates;

  /** 
   * Subscription for subjects 
   * to quit in destroy lifecycle
   */
  formDataSubscription: Subscription = null;
  pdfDataSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService,
    private projectService: ProjectsService,
    private _snackBar: MatSnackBar    
  ) {}
  ngOnInit() {
    console.log(this);
    
    // Listen for node addition from pdf-viewer
    this.pdfDataSubscription = 
      this.dataFlow.$pdfDataSource.subscribe(
        (node:VisNetworkGraphNode) => {
          if (!node) return;

          // Convert DOM coordinate to canvas coordinate
          const coord = 
            this.visjsNetworkGraph
              .network.DOMtoCanvas({x: node.x, y: node.y});
          const label = node.label;
          const group = node.group;

          // TODO ADD NODE
          const cmd = {
            action: 'add node',
            data: {
              label,
              group,
              coord
            }
          };
          this.recordCommand(cmd);
        }
      );

    // Listen for graph update from side-bar-ui
    this.formDataSubscription =
      this.dataFlow.formDataSource.subscribe(
        (update: Update) => {
          if (!update) return;

          const event = update.event;
          const type = update.type;

          if (event === 'delete' &&  type === 'node') {
            // TODO REMOVE NODE
            const cmd = {
              action: 'delete node',
              data: update.data as VisNetworkGraphNode
            }
            this.recordCommand(cmd);
          } else if (event === 'delete' &&  type === 'edge') {
            // TODO REMOVE EDGE
            const cmd = {
              action: 'delete edge',
              data: update.data as VisNetworkGraphEdge
            };
            this.recordCommand(cmd);
          } else if (event === 'update' && type === 'node') {
            // TODO UPDATE NODE
            const cmd = {
              action: 'update node',
              data: update.data as VisNetworkGraphNode
            };
            this.recordCommand(cmd);
          } else if (event === 'update' && type === 'edge') {
            // TODO UPDATE EDGE
            const cmd = {
              action: 'update edge',
              data: update.data as VisNetworkGraphEdge
            };
            this.recordCommand(cmd);
          }
        }
      );
  }
  ngAfterViewInit() {
    setTimeout(() => {
      // Init network graph object
      this.visjsNetworkGraph = new NetworkVis(
        document.getElementById('canvas')
      );

      // Listen for project sent from project-list view
      this.dataFlow.$projectlist2Canvas.subscribe(
        (project) => {
          if (!project) return;

          this.project = project;

          // Convert graph from universal to vis.js format
          let g = this.projectService.universe2Vis(project.graph);

          // Draw graph around data
          this.visjsNetworkGraph.draw(
            g.nodes,
            g.edges
          );

          /**
           * Event handlers
           */
          this.visjsNetworkGraph.network.on(
            'click',
            (properties) => {
              if (this.addMode) {
                if (properties.nodes.length) {
                  let target_id:string = properties.nodes[0];

                  // TODO ADD EDGE
                  const cmd = {
                    action: 'add edge',
                    data: {
                      edge: {
                        from: this.node4AddingEdge2,
                        to: target_id
                      }
                    }
                  };
                  this.recordCommand(cmd);
                }

                // Reset dragging gesture rendering
                this.visjsNetworkGraph.removeNode(
                  "EDGE_FORMATION_DRAGGING"
                );
                this.addMode = false;
              } else {
                if (properties.nodes.length) {
                  // If a node is clicked on
                  let node_id = properties.nodes[0];
                  let data = this.visjsNetworkGraph.getNode(node_id);
                  this.dataFlow.pushGraphData(data);
                  this.sideBarUIToggle(true);
                } else if (properties.edges.length) {
                  // If an edge is clicked on
                  let edge_id = properties.edges[0];
                  let data = this.visjsNetworkGraph.getEdge(edge_id);
                  this.dataFlow.pushGraphData(data);
                  this.sideBarUIToggle(true);
                }
              }
            }
          );
          this.visjsNetworkGraph.network.on(
            'doubleClick',
            (properties) => {
              if (!properties.nodes.length) return;

              // Set up rendering gesture for the node
              this.node4AddingEdge2 = properties.nodes[0];
              this.addMode = true;

              var e = properties.event.srcEvent;
              var canvasOffset = $('#canvas > div > canvas').offset();

              // Convert DOM coordinate to canvas coordinate
              let coord = this.visjsNetworkGraph.network.DOMtoCanvas({
                x: e.pageX - canvasOffset.left,
                y: e.pageY - canvasOffset.top
              });

              // Place placeholder node near mouse cursor
              let addedNode = this.visjsNetworkGraph.addNode(
                {
                  "size": 0,
                  "shape": "dot",
                  "id": "EDGE_FORMATION_DRAGGING"
                },
                coord.x - 5,
                coord.y - 5
              );

              // Add edge from selected node to placeholder node
              this.visjsNetworkGraph.addEdge(
                this.node4AddingEdge2,
                addedNode['id']
              );
            }
          );
          // Listen for nodes moving on canvas
          this.visjsNetworkGraph.network.on(
            'dragEnd',
            (properties) => {
              if (properties.nodes.length) this.saveState = false;
            }
          );
          // Listen for mouse movement on canvas to render
          // edge formation gesture during addMode
          $('#canvas > div > canvas').mousemove(
            (e) => {
              if (!this.addMode) return;

              var canvasOffset = $('#canvas > div > canvas').offset();

              // Convert DOM coordinate to canvas coordinate
              let coord = this.visjsNetworkGraph.network.DOMtoCanvas({
                x: e.pageX - canvasOffset.left,
                y: e.pageY - canvasOffset.top
              });

              // Render placeholder node near mouse cursor
              this.visjsNetworkGraph.network.moveNode(
                "EDGE_FORMATION_DRAGGING",
                coord.x - 5,
                coord.y - 5
              );
            }
          );
        }
      );
    }, 250);
  }
  ngOnDestroy() {
    // Unsubscribe from subscriptions
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();

    // Reset BehaviorSubjects form dataFlow service
    this.dataFlow.pushGraphData(null);
    this.dataFlow.pushGraphUpdate(null);
    this.dataFlow.pushNode2Canvas(null);
  }

  undo() {
    // Pop the action from undo stack
    let undoAction = this.undoStack.pop();
  
    console.log(undoAction, 'undo')
  
    // Record the current state of graph into redo action
    let redoAction = {
      graph: Object.assign({}, this.visjsNetworkGraph.export()),
      cmd: undoAction.cmd
    }
  
    // Undo action
    this.visjsNetworkGraph.import(
      undoAction.graph
    );
  
    // Push redo action into redo stack
    this.redoStack.push(redoAction);
  }
  
  redo() {
    // Pop the action from redo stack
    let redoAction = this.redoStack.pop();
  
    // Record the current state of graph into undo action
    let undoAction = {
      graph: Object.assign({}, this.visjsNetworkGraph.export()),
      cmd: redoAction.cmd
    }
  
    // Redo action
    this.visjsNetworkGraph.import(
      redoAction.graph
    );
  
    // Push undo action into undo stack
    this.undoStack.push(undoAction);
  }

  /**
   * Process all modification cmd to the graph representation
   * @param cmd The cmd to execute and push to stack
   * @param push Whether or not to push to undo stack
   */
  recordCommand(cmd: Command) {
    this.saveState = false;
  
    this.currentGraphState = this.visjsNetworkGraph.export();
    
    this.undoStack.push({
      graph: Object.assign({}, this.currentGraphState),
      cmd: cmd.action
    });
    this.redoStack = [];
    

    switch(cmd.action) {
      case 'add node':
        // Add node to network graph
        let addedNode = this.visjsNetworkGraph.addNode(
          {
          label: cmd.data.label,
          group: cmd.data.group,
          },
          cmd.data.coord.x,
          cmd.data.coord.y
        );
        // Toggle side-bar-ui for added node
        let data = this.visjsNetworkGraph.getNode(addedNode.id);
        this.dataFlow.pushGraphData(data);
        this.sideBarUIToggle(true);
        break;
      case 'update node':
        // Update node
        this.visjsNetworkGraph.updateNode(
          cmd.data.node.id,
          {
            label: cmd.data.node.label,
            group: cmd.data.node.group
          }
        );
        // Update edges of node
        cmd.data.edges.map(e => {
          this.visjsNetworkGraph.updateEdge(
            e['id'],
            {
              label: e['label'],
              from: e['from'],
              to: e['to']
            }
          );
        });
        break;
      case 'delete node':
        this.visjsNetworkGraph.removeNode(cmd.data.id);
        this.sideBarUIToggle();
        break;
      case 'add edge':
        this.visjsNetworkGraph.addEdge(
          cmd.data.edge.from,
          cmd.data.edge.to
        );
        break;
      case 'update edge':
        this.visjsNetworkGraph.updateEdge(
          cmd.data.edge.id,
          cmd.data.edge
        );
        break;
      case 'delete edge':
        this.visjsNetworkGraph.removeEdge(cmd.data.id)
        break;
      default:
        break;
    }
  }

  /**
   * Event handler for node template dropping onto canvas
   * @param event 
   */
  drop(event: CdkDragDrop<any>) {
    console.log(event);

    const node_type = event.item.element.nativeElement.id;
    const label = `${node_type}-${makeid()}`;

    // Get DOM coordinate of dropped node relative
    // to container DOM
    const node_coord: DOMRect = 
      document
        .getElementById(node_type)
        .getBoundingClientRect() as DOMRect;
    const container_coord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;
    const x = 
      node_coord.x - 
      container_coord.x +
      event.distance.x;
    const y =
      node_coord.y + event.distance.y + 16;

    // Convert DOM coordinate to canvas coordinate
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({x: x, y: y});

    // TODO ADD NODE
    const cmd = {
      action: 'add node',
      data: {
        group: node_type,
        label,
        coord
      }
    }
    this.recordCommand(cmd);
  }
  
  /**
   * Save the current representation of knowledge model
   */
  save() {
    // Export the graph from vis_js instance object
    let graph = this.visjsNetworkGraph.export();

    // Convert it to universal representation ..
    this.project.graph = this.projectService.vis2Universe(graph);;
    this.project.date_modified = new Date().toISOString()

    // Push to backend to save
    this.projectService.updateProject(this.project)
      .subscribe(resp => {
        console.log(resp);

        this.saveState = true;
        this._snackBar.open('Project is saved', null, {
          duration: 2000,
        });
      });
  }

  // -- Helpers -- 

  /**
   * Controls expanding/decompressing the side-bar-ui
   * @param open - if true, will open regardless
   */
  sideBarUIToggle(open: boolean = false) {
    let w = $('#side-bar-ui').width();

    if (!w || open) {
      // Expand sidebar ui
      $('#side-bar-ui').animate({
        width: '20rem'
      }, 500, () => {
        $('#side-bar-ui > #side-bar-ui-container ')
        .children()
        .css('width', 'auto');
      });
    } else {
      // Compress sidebar ui
      $('#side-bar-ui').animate({
        width: '0rem'
      }, 500, () => {
        $('#side-bar-ui > #side-bar-ui-container ')
        .children()
        .css('width', '0rem');
      });
    }    
  }
  /**
   * Build key,value pair style dict
   * from node_template
   * @param node_template 
   */
  nodeStyleCompute(node_template) {
    return {
      color: node_template['color'],
      background: node_template['background']
    }
  }

  fitAll() {
    this.visjsNetworkGraph.zoom2All();
  }
}
