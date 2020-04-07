import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';

import * as $ from 'jquery';

import {
  nodeTemplates,
  uuidv4,
  DataFlowService
} from '../../services';
import {
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  GraphData
} from '../../services/interfaces';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { isNullOrUndefined } from 'util';

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
}

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit, OnDestroy {
  /** Build the palette ui with node templates defined */
  nodeTemplates = nodeTemplates;

  paletteMode = 'minimized';

  /**
   * The information of the node clicked
   * on from the knowledge graph
   */
  graphData: GraphData = {
    id: '',
    label: '',
    group: '',
    edges: [],
    hyperlink: ''
  };

  /**
   * Track modification of entity properties
   */
  entityForm = new FormGroup({
    id: new FormControl(),
    label: new FormControl(),
    group: new FormControl(),
    edges: new FormArray([]),
    hyperlink: new FormControl()
  }, {
    updateOn: 'blur'
  });

  /** Prevent formgroup from firing needlessly */
  pauseForm = false;

  /** Type of data we're dealing with, node or edge */
  entityType = 'node';

  nodeBank: VisNetworkGraphNode[] = [];
  nodeBankDict: {[hash: string]: object} = {};

  /**
   * Return true or false if any edges exist
   */
  get edges() {
    return this.entityForm.value.edges.length === 0 ? false : true;
  }
  /**
   *
   */
  get edgeFormArr() {
    return this.entityForm.get('edges') as FormArray;
  }
  get isNode() {
    return this.entityType === 'node';
  }

  graphDataSubscription: Subscription = null;
  formSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService
  ) { }

  ngOnInit() {
    // Listen for changes within the form
    // in edit mode
    this.formSubscription = this.entityForm.valueChanges
      .pipe(
        filter(_ => !this.pauseForm)
      )
      .subscribe(
        (val: GraphData) => {
          if (isNullOrUndefined(val)) { return; }

          let data;

          if (this.entityType === 'node') {
            // Get node data
            const edges = val.edges.map((e: VisNetworkGraphEdge) => {

              return {
                id: e.id,
                label: e.label,
                from: val.id,
                to: e.to
              };
            });

            data = {
              node: {
                id: this.graphData.id,
                label: val.label,
                group: val.group,
                data: {
                  hyperlink: val.hyperlink
                }
              },
              edges
            };
          } else {
            // Get edge data
            data = {
              edge: {
                id: this.graphData.id,
                label: val.label
              }
            };
          }

          // Push graph update to drawing-tool view
          this.dataFlow.pushGraphUpdate({
            type: this.entityType,
            event: 'update',
            data
          });

          // Update graphData ..
          this.graphData = val;
        }
      );

    // Listen for when a node and its data
    // is streamed ..
    this.graphDataSubscription = this.dataFlow.graphDataSource.subscribe((data: GraphSelectionData) => {
      if (!data) { return; }

      // If a node is clicked on ..
      if (data.node_data) {
        this.entityType = 'node';

        // Record the data ..
        this.graphData = data.node_data;
        data.other_nodes.map(n => {
          this.nodeBankDict[n.id] = n;
        });
        this.nodeBank = data.other_nodes;

        this.pauseForm = true;

        // Set FormArray of FormControls to edges of node
        this.entityForm.setControl(
          'edges',
          new FormArray(
            this.graphData.edges.map(e => {
              return new FormGroup({
                to: new FormControl(),
                label: new FormControl(),
                id: new FormControl()
              });
            })
          )
        );

        // Set FormGroup for node ..
        const formData = {
          id: this.graphData.id,
          label: this.graphData.label,
          group: this.graphData.group,
          edges: this.graphData.edges.map((e: VisNetworkGraphEdge) => {
            return {
              id: e.id,
              label: e.label,
              to: e.to
            };
          }),
          hyperlink: data.node_data.data.hyperlink
        };
        this.entityForm.setValue(formData, {emitEvent: false});

        this.pauseForm = false;
      } else if (data.edge_data) {
        // Else if an edge is clicked on ..
        this.entityType = 'edge';

        // Record the data ..
        this.graphData = data.edge_data;

        // Setup FormGroup for Edge ..
        this.pauseForm = true;
        this.entityForm.setControl(
          'edges',
          new FormArray([])
        );
        this.pauseForm = false;
        const formData = {
          id: this.graphData.id,
          label: this.graphData.label,
          group: null,
          edges: [],
          hyperlink: null
        };
        this.entityForm.setValue(formData, {emitEvent: false});
      }

      if (this.paletteMode === 'minimized') { this.changeSize(); }
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
    this.graphData = {
      id: '',
      label: '',
      group: '',
      edges: [],
      hyperlink: ''
    };

    this.pauseForm = true;
    this.entityForm.setControl(
      'edges',
      new FormArray([])
    );
    this.entityForm.reset();
    this.pauseForm = false;

    this.changeSize('maximized');
  }

  /**
   * Either delete the node or edge that the info-panel-ui
   * is showcasing ..
   */
  delete() {
    const id = this.graphData.id;

    // push changes to app.component.ts
    this.dataFlow.pushGraphUpdate({
      event: 'delete',
      type: this.entityType,
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
    (this.entityForm.controls.edges as FormArray).push(
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
   * @param form the form control to manipulate
   * @param i the index of the edge to remove
   */
  deleteEdge(form, i) {
    const edge = form.value;

    // remove form control
    (this.entityForm.controls.edges as FormArray).removeAt(i);

    // remove from information dislay
    this.graphData.edges = this.graphData.edges.filter(
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

  changeSize(paletteMode = null) {

    if (paletteMode) { this.paletteMode = paletteMode; }

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

  goToLink() {
    const hyperlink: string = this.entityForm.value.hyperlink;

    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else {
      window.open('http://' + hyperlink);
    }
  }

  blurInput(e: Event) {
    (e.target as HTMLElement).blur();
  }
}
