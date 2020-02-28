import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import {
  trigger,
  style,
  animate,
  transition
} from '@angular/animations';
import { filter } from 'rxjs/operators';

import { 
  DataFlowService,
  node_templates,
  uuidv4
} from '../../services';
import { Subscription } from 'rxjs';


interface Edge {
  id: number|string,
  from: number|string,
  to: number|string,
  label: string
};
interface Node {
  id: number|string,
  group: string,
  label: string
};
interface GraphData {
  id: number|string;
  label: string;
  group?: string;
  edges?: Edge[];
}
interface GraphSelectionData {
  edge_data?: {
    id: number|string,
    label: string
  };
  node_data?: {
    id: number|string,
    group: string,
    label: string,
    edges: Edge[]
  },
  other_nodes?: Node[];
};

@Component({
  selector: 'side-bar-ui',
  templateUrl: './side-bar-ui.component.html',
  styleUrls: ['./side-bar-ui.component.scss'],
  animations: [
    trigger(
      'enterAnimation', [
        transition(':enter', [
          style({opacity: 0}),
          animate('500ms', style({opacity: 1}))
        ]),
        transition(':leave', [
          style({opacity: 1}),
          animate('500ms', style({transform: 'translateX(100%)', opacity: 0}))
        ])
      ]
    )
  ]
})
export class SideBarUiComponent implements OnInit, OnDestroy {
  /**
   * The information of the node clicked
   * on from the knowledge graph
   */
  graph_data: GraphData = {
    id: '',
    label: '',
    group: '',
    edges: []
  };

  /** Type of data we're dealing with, node or edge */
  data_type: string = 'node';
  
  /** Hold other nodes from graph by id */
  other_nodes_dict = {};
  other_nodes = [];

  /**
   * Track modification of node properties
   */
  graph_data_form = new FormGroup({
    id: new FormControl(),
    label: new FormControl('Untitled'),
    group: new FormControl('Unknown'),
    edges: new FormArray([])
  },{
    updateOn: 'blur'
  });

  /** Control whether to show display or form ui */
  edit_mode = true;

  types = node_templates;

  /** Prevent formgroup from firing needlessly */
  pauseForm = false;

  get edgeForm() {
    return <FormArray>this.graph_data_form.get('edges');
  }

  graphDataSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService
  ) { }

  ngOnInit() {
    // Listen for changes within the form
    // in edit mode
    this.graph_data_form.valueChanges
      .pipe(
        filter(_ => !this.pauseForm)
      )
      .subscribe(
        val => {
          if (!val) return;

          let data;

          if (this.data_type === "node") {
            // Get node data
            let edges = val['edges'].map(e => {
              return {
                id: e['id'],
                label: e['label'],
                from: val['id'],
                to: e['to']
              }
            });
            
            data = {
              node: {
                id: this.graph_data.id,
                label: val['label'],
                group: val['group']
              },
              edges
            }
          } else {
            // Get edge data
            data = {
              edge: {
                id: this.graph_data.id,
                label: val['label']
              }
            }
          }

          // Push graph update to drawing-tool view
          this.dataFlow.pushGraphUpdate({
            type: this.data_type,
            event: 'update',
            data
          });

          // Update graph_data ..
          this.graph_data = val;
        }
      );

    // Listen for when a node is clicked on and its data
    // is streamed .. 
    this.graphDataSubscription = this.dataFlow.graphDataSource.subscribe((data: GraphSelectionData) => {
      if (!data) return;

      // If a node is clicked on ..
      if (data.node_data) {
        this.data_type = 'node';

        // Record the data .. 
        this.graph_data = data.node_data;
        data.other_nodes.map(n => {
          this.other_nodes_dict[n.id] = n;
        });
        this.other_nodes = data.other_nodes;

        this.pauseForm = true;

        // Set FormArray of FormControls to edges of node
        this.graph_data_form.setControl(
          'edges',
          new FormArray(
            this.graph_data.edges.map(e => {
              return new FormGroup({
                to: new FormControl(),
                label: new FormControl(),
                id: new FormControl()
              });
            })
          )
        );

        // Set FormGroup for node ..
        let form_data = {
          id: this.graph_data.id,
          label: this.graph_data.label,
          group: this.graph_data.group,
          edges: this.graph_data.edges.map((e:Edge) => {

            return {
              id: e.id,
              label: e.label,
              to: e.to
            }
          })
        };
        this.graph_data_form.setValue(form_data, {emitEvent: false});     
        
        this.pauseForm = false;
      }

      // Else if an edge is clicked on ..
      else if (data.edge_data) {
        this.data_type = 'edge';

        // Record the data ..
        this.graph_data = data.edge_data;

        // Setup FormGroup for Edge ..
        this.pauseForm = true;
        this.graph_data_form.setControl(
          'edges',
          new FormArray([])
        );
        this.pauseForm = false;
        let form_data = {
          id: this.graph_data.id,
          label: this.graph_data.label,
          group: null,
          edges: []
        };
        this.graph_data_form.setValue(form_data, {emitEvent: false});
      }

    });
  }

  ngOnDestroy() {
    // Unsubscribe subscription to prevent transaction
    // with subject on accident when re-init next time
    this.graphDataSubscription.unsubscribe();
  }

  /**
   * Return label
   * @param id 
   */
  getOtherNodeLabel(id) {
    if (Object.keys(this.other_nodes_dict).length) {
      return this.other_nodes_dict[id].label;
    } else {
      return 'Untitled';
    }
  }

  /**
   * 
   */
  toggleEditMode() {
    this.edit_mode = !this.edit_mode;
  }

  /**
   * Either delete the node or edge that the side-bar-ui
   * is showcasing ..
   */
  delete() {
    const id = this.graph_data.id;

    // push changes to app.component.ts
    this.dataFlow.pushGraphUpdate({
      event: 'delete',
      type: this.data_type,
      data: {
        id
      }
    });

    // reset everything of component's members
    this.graph_data = {
      id: '',
      label: '',
      group: '',
      edges: []
    };

    this.pauseForm = true;
    this.graph_data_form.reset();
    this.pauseForm = false;
  }

  /**
   * Delete the edge that is part of the node
   * @param form 
   * @param i 
   */
  deleteEdge(form, i) {
    let edge = form.value;

    // remove form control
    (this.graph_data_form.controls['edges'] as FormArray).removeAt(i);

    // remove from information dislay
    this.graph_data.edges = this.graph_data.edges.filter(
      e => e.id !== edge.id
    );

    // push changes to app.component.ts
    this.dataFlow.pushGraphUpdate({
      event: 'delete',
      type: 'edge',
      data: {
        id: edge.id
      }
    });
  }

  /**
   * 
   */
  addEdge() {
    this.pauseForm = true;

    // add form control to modify edge
    (this.graph_data_form.controls['edges'] as FormArray).push(
      new FormGroup({
        to: new FormControl(
          null
        ),
        label: new FormControl(
          null
        ),
        id: new FormControl(
          uuidv4()
        )
      })
    );
    this.pauseForm = false;
  }

  blurInput(e: Event) {
    (e.srcElement as HTMLElement).blur();
  }
}
