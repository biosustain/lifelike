import { Component, OnInit, OnDestroy, ViewChild, NgZone, Output } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import { MatCheckboxChange } from '@angular/material';
import {
  EventEmitter
} from '@angular/core';

import * as $ from 'jquery';

import {
  uuidv4,
  DataFlowService
} from '../../services';
import {
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  GraphData,
  GraphSelectionData,
  LaunchApp
} from '../../services/interfaces';

import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { LINK_NODE_ICON_OBJECT } from 'app/constants';
import { annotationTypes } from 'app/shared/annotation-styles';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit, OnDestroy {
  @ViewChild('autosize', {static: true}) autosize: CdkTextareaAutosize;
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();

  /** Build the palette ui with node templates defined */
  nodeTemplates = annotationTypes;

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
    hyperlink: '',
    detail: '',
    data: {
      source: '',
      search: [],
      subtype: ''
    }
  };

  nodeIsIcon = false;

  /**
   * Track modification of entity properties
   */
  entityForm = new FormGroup({
    id: new FormControl(),
    label: new FormControl(),
    group: new FormControl(),
    edges: new FormArray([]),
    hyperlink: new FormControl(),
    detail: new FormControl(),
    subtype: new FormControl(),
  }, {
    updateOn: 'blur'
  });

  /** Prevent formgroup from firing needlessly */
  pauseForm = false;

  /** Type of data we're dealing with, node or edge */
  entityType = 'node';

  nodeBank: VisNetworkGraphNode[] = [];
  nodeBankDict: {[hash: string]: object} = {};

  /** Whether or not show all edges */
  edgeCollapsed = false;

  get edgeListStyle() {
    return {
      collapsed: this.edgeCollapsed
    };
  }

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

  get subtypes() {
    const nT = this.nodeTemplates.filter(
      t => t.label === this.entityForm.value.group
    )[0];

    if (nT.subtypes && nT.subtypes.length) {
      return nT.subtypes;
    } else {
      return [];
    }
  }

  graphDataSubscription: Subscription = null;
  formSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    // Listen for changes within the form
    // in edit mode
    this.formSubscription = this.entityForm.valueChanges
      .pipe(
        filter(_ => !this.pauseForm)
      )
      .subscribe(
        (val: any) => {
          if (isNullOrUndefined(val)) { return; }

          let data;

          if (this.entityType === 'node') {
            // Get node data

            // tslint:disable-next-line: no-shadowed-variable
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
                  hyperlink: val.hyperlink,
                  detail: val.detail,
                  source: this.graphData.data.source || '',
                  search: this.graphData.data.search || [],
                }
              },
              edges
            };

            const nodeTemplate = this.nodeTemplates.filter(
              nT => val.group === nT.label
            )[0];
            const subtypeExist = nodeTemplate.subtypes && nodeTemplate.subtypes.length;
            data.node.data.subtype = subtypeExist ? val.subtype : '';

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
          const {
            id,
            label,
            group,
            edges,
            hyperlink,
            detail
          } = val;

          this.graphData = {
            id,
            label,
            group,
            edges,
            hyperlink,
            detail,
            data: this.graphData.data
          };
        }
      );

    // Listen for when a node and its data
    // is streamed ..
    this.graphDataSubscription = this.dataFlow.graphDataSource.subscribe((data: GraphSelectionData) => {
      if (!data) { return; }

      // If a node is clicked on ..
      if (data.nodeData) {
        this.entityType = 'node';

        this.nodeIsIcon = data.nodeData.shape === 'icon';

        // Record the data ..
        this.graphData = data.nodeData;
        data.otherNodes.map(n => {
          this.nodeBankDict[n.id] = n;
        });
        this.nodeBank = data.otherNodes;

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
          hyperlink: data.nodeData.data.hyperlink || '',
          detail: data.nodeData.data.detail || '',
          subtype: data.nodeData.data.subtype || ''
        };
        this.entityForm.setValue(formData, {emitEvent: false});

        this.pauseForm = false;
      } else if (data.edgeData) {
        // Else if an edge is clicked on ..
        this.entityType = 'edge';

        // Record the data ..
        this.graphData = data.edgeData;

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
          hyperlink: null,
          detail: null
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

  /**
   * Hide or show the edges
   */
  toggleCollapsible() {
    this.edgeCollapsed = !this.edgeCollapsed;
  }

  /**
   * Reset info-panel to a clean state
   */
  reset(minimize= true) {
    // reset everything of component's members
    this.graphData = {
      id: '',
      label: '',
      group: '',
      edges: [],
      hyperlink: '',
      detail: ''
    };

    this.edgeCollapsed = false;

    this.pauseForm = true;
    this.entityForm.setControl(
      'edges',
      new FormArray([])
    );
    this.entityForm.reset();
    this.pauseForm = false;

    if (minimize) {
      this.changeSize('maximized');
    }
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
    this.edgeCollapsed = false;
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

  /**
   * Allow user to navigate to a link in a new tab
   */
  goToLink(url= null) {
    const hyperlink: string = url || this.entityForm.value.hyperlink;

    if (!hyperlink) { return; }

    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else if (
      hyperlink.includes('mailto')
    ) {
      window.open(hyperlink);
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Bring user to original source of node information
   */
  goToSource() {
    if (
      this.graphData.data.source.includes('/dt/pdf')
    ) {
      const prefixLink = '/dt/pdf/';
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD
      ] = this.graphData.data.source.replace(prefixLink, '').split('/');
      // Emit app command with annotation payload
      this.openApp.emit({
          app: 'pdf-viewer',
          arg: {
            // tslint:disable-next-line: radix
            pageNumber: parseInt(page),
            fileId,
            coords: [
              parseFloat(coordA),
              parseFloat(coordB),
              parseFloat(coordC),
              parseFloat(coordD)
            ]
          }
        }
      );
    } else if (
      this.graphData.data.source.includes('/dt/map')
    ) {
      const hyperlink = window.location.origin  + this.graphData.data.source;
      window.open(hyperlink, '_blank');
    }
  }

  blurInput(e: Event) {
    (e.target as HTMLElement).blur();
  }
}
