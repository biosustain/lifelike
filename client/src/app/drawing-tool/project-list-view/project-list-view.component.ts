import { 
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import {
  MatDialog
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OverlayRef, Overlay } from '@angular/cdk/overlay';
import { Subscription, Observable, fromEvent } from 'rxjs';
import { TemplatePortal } from '@angular/cdk/portal';
import { filter, take } from 'rxjs/operators';

import {
  ProjectsService,
  DataFlowService,
  uuidv4
} from '../services';
import {
  Project,
  VisNetworkGraphEdge
} from '../services/interfaces';
import {
  GraphSelectionData
} from '../drawing-tool/info-panel/info-panel.component';
import {
  NetworkVis
} from '../network-vis';
import {
  CreateProjectDialogComponent
} from './create-project-dialog/create-project-dialog.component';
import {
  DeleteProjectDialogComponent
} from './delete-project-dialog/delete-project-dialog.component';
import {
  CopyProjectDialogComponent
} from './copy-project-dialog/copy-project-dialog.component';

declare var $: any;

@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent implements OnInit, AfterViewInit {
  /**
   * List of projects owned by user
   */
  projects: Project[] = [];

  /**
   * Project in focus
   */
  selectedProject = null;

  /**  */
  visGraph: NetworkVis = null;

  screenMode: string = 'shrink';

  focusedEntity: GraphSelectionData;

  get node() {
    if (!this.focusedEntity) return null;
    
    return this.focusedEntity['node_data'];
  }

  constructor(
    private projectService: ProjectsService
  ) { }

  ngOnInit() {}

  ngAfterViewInit() {
    this.projectService.pullProjects()
      .subscribe(data => {
        this.projects = Array(10).fill(
          data['projects'][0]
        ) as Project[];

        // Sort project by most recent modified date
        this.projects.sort(
          (a, b) => {
            return (a.date_modified < b.date_modified) ? -1 : ((a.date_modified > b.date_modified) ? 1 : 0);
          }
        );
        this.projects.reverse();
      });

    setTimeout(
      () => {
        // this.toggle();
      },
      2000
    )
  }

  getNode(edge: VisNetworkGraphEdge) {
    return this.focusedEntity.other_nodes.filter(
      node => node.id === edge.to
    )[0].label;
  }

  fit() {
    this.visGraph.zoom2All();
  }
  toggle() {
    this.screenMode = this.screenMode === 'shrink' ? 'grow' : 'shrink';

    let list_width = this.screenMode === 'shrink' ? '25%' : '0%',
    preview_width = this.screenMode === 'shrink' ? '75%' : '100%',
    list_duration = this.screenMode === 'shrink' ? 500 : 400,
    preview_duration = this.screenMode === 'shrink' ? 400 : 500,
    container_height = this.screenMode === 'shrink' ? '70vh' : '100vh',
    panel_height = this.screenMode === 'shrink' ? '30vh' : '0vh';

    $('#map-list-container').animate({width: list_width}, list_duration);
    $('#map-preview').animate({width: preview_width}, preview_duration);

    $('#canvas-container').animate({height: container_height}, 600)
    $('#map-panel').animate({height: panel_height}, 600)
  }

  /**
   * Open right side-bar with project meta information 
   * in view
   * @param proj 
   */
  pickProject(proj: Project) {

    this.selectedProject = proj;

    let container = document.getElementById('canvas');
    this.visGraph = new NetworkVis(container);

    let g = this.projectService.universe2Vis(proj.graph);

    setTimeout(
      () => {
        this.visGraph.draw(
          g.nodes,
          g.edges
        );

        this.visGraph.network.on(
          'click',
          (properties) => this.networkClickHandler(properties)
        );
      },
      100
    )
  }
  /**
   * Listen for click events from vis.js network
   * to handle certain events ..
   * - if a node is clicked on 
   * - if a edge is clicked on 
   * - if a node is clicked on during addMode
   * @param properties 
   */
  networkClickHandler(properties) {

    if (properties.nodes.length) {
      // If a node is clicked on
      let node_id = properties.nodes[0];
      let data = this.visGraph.getNode(node_id);
      this.focusedEntity = data;
      console.log(data);
    } else if (properties.edges.length) {
      // If an edge is clicked on
      // do nothing .. 
      // let edge_id = properties.edges[0];
      // let data = this.visGraph.getEdge(edge_id);
      // this.focusedEntity = data;
      // console.log(data);
    }
  }
}
