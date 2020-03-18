import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';

import * as $ from 'jquery';

import {
  node_templates,
  uuidv4,
  DataFlowService
} from '../../services'
import {
  VisNetworkGraphEdge,
  VisNetworkGraphNode
} from '../../services/interfaces'
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface GraphData {
  id?: string;
  label?: string;
  group?: string;
  edges?: VisNetworkGraphEdge[];
  hyperlink?: string;
}
interface GraphSelectionData {
  edge_data?: VisNetworkGraphEdge;
  node_data?: {
    id: string,
    group: string,
    label: string,
    edges: VisNetworkGraphEdge[],
    data: {
      hyperlink: string;
    }
  };
  other_nodes?: VisNetworkGraphNode[];
};

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit {
  /** Build the palette ui with node templates defined */
  nodeTemplates = node_templates;

  paletteMode: string = 'minimized';

  /**
   * The information of the node clicked
   * on from the knowledge graph
   */
  graph_data: GraphData = {
    id: '',
    label: '',
    group: '',
    edges: [],
    hyperlink: ''
  };

  /**
   * Track modification of entity properties
   */
  entity_form = new FormGroup({
    id: new FormControl(),
    label: new FormControl('Untitled'),
    group: new FormControl('Unknown'),
    edges: new FormArray([]),
    hyperlink: new FormControl()
  },{
    updateOn: 'blur'
  });

  /** Prevent formgroup from firing needlessly */
  pauseForm = false;

  /** Type of data we're dealing with, node or edge */
  entity_type: string = 'node';

  node_bank: VisNetworkGraphNode[] = [];
  node_bank_dict: {[hash: string]: Object} = {};

  /**
   * Return true or false if any edges exist
   */
  get edges() {
    return this.entity_form.value.edges.length === 0 ? false : true;
  }
  /**
   * 
   */
  get edgeFormArr() {
    return <FormArray>this.entity_form.get('edges');
  }

  graphDataSubscription: Subscription = null;
  formSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService
  ) { }

  ngOnInit() {
    // Listen for changes within the form
    // in edit mode
    this.formSubscription = this.entity_form.valueChanges
      .pipe(
        filter(_ => !this.pauseForm)
      )
      .subscribe(
        val => {
          if (!val) return;

          console.log(val);

          let data;

          if (this.entity_type === "node") {
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
                group: val['group'],
                hyperlink: val['hyperlink']
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
            type: this.entity_type,
            event: 'update',
            data
          });

          // Update graph_data ..
          this.graph_data = val;
        }
      );

    // Listen for when a node and its data
    // is streamed .. 
    this.graphDataSubscription = this.dataFlow.graphDataSource.subscribe((data: GraphSelectionData) => {
      if (!data) return;

      console.log(data);

      // If a node is clicked on ..
      if (data.node_data) {
        this.entity_type = 'node';

        // Record the data .. 
        this.graph_data = data.node_data;
        data.other_nodes.map(n => {
          this.node_bank_dict[n.id] = n;
        });
        this.node_bank = data.other_nodes;

        this.pauseForm = true;

        // Set FormArray of FormControls to edges of node
        this.entity_form.setControl(
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
          edges: this.graph_data.edges.map((e:VisNetworkGraphEdge) => {
            return {
              id: e.id,
              label: e.label,
              to: e.to
            }
          }),
          hyperlink: data.node_data.data.hyperlink
        };
        this.entity_form.setValue(form_data, {emitEvent: false});
        
        this.pauseForm = false;
      }

      // Else if an edge is clicked on ..
      else if (data.edge_data) {
        this.entity_type = 'edge';

        // Record the data ..
        this.graph_data = data.edge_data;

        // Setup FormGroup for Edge ..
        this.pauseForm = true;
        this.entity_form.setControl(
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
        this.entity_form.setValue(form_data, {emitEvent: false});
      }

      if (this.paletteMode === 'minimized') this.changeSize();
    });
  }

  ngOnDestroy() {
    // Unsubscribe subscription to prevent transaction
    // with subject on accident when re-init next time
    this.graphDataSubscription.unsubscribe();
    this.formSubscription.unsubscribe();    
  }

  reset() {
    // reset everything of component's members
    this.graph_data = {
      id: '',
      label: '',
      group: '',
      edges: [],
      hyperlink: ''
    };

    this.pauseForm = true;
    this.entity_form.setControl(
      'edges',
      new FormArray([])
    );
    this.entity_form.reset();
    this.pauseForm = false;

    this.changeSize('maximized');
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
      type: this.entity_type,
      data: {
        id
      }
    });

    // reset everything of component's members
    this.reset();
  }

  /**
   * Add edge to through FormControl
   */
  addEdge() {
    this.pauseForm = true;

    // add form control to modify edge
    (this.entity_form.controls['edges'] as FormArray).push(
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

  /**
   * Delete the edge that is part of the node
   * @param form 
   * @param i 
   */
  deleteEdge(form, i) {
    let edge = form.value;

    // remove form control
    (this.entity_form.controls['edges'] as FormArray).removeAt(i);

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

  changeSize(paletteMode=null) {

    if (paletteMode) this.paletteMode = paletteMode;

    switch (this.paletteMode) {
      case 'minimized':
        $('#info-panel').animate({
          height: '36rem'
        }, 500, () => {
          this.paletteMode = 'normal';
        });
        break;        
      case 'normal':
        $('#info-panel').animate({
          height: '80vh'
        }, 500, () => {
          this.paletteMode = 'maximized';
        });         
        break;
      case 'maximized':
        $('#info-panel').animate({
          height: '52px'
        }, 500, () => {
          this.paletteMode = 'minimized';
        });    
        break;
      default:
        break;
    } 
  }

  goToLink(url: string){
    window.open(url, "_blank");
  }

  blurInput(e: Event) {
    (e.srcElement as HTMLElement).blur();
  }
}
