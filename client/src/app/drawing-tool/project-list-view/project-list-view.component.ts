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
import { MatSnackBar } from '@angular/material';

declare var $: any;

@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent implements OnInit, AfterViewInit {
  /** Template to inject contextmenu in */
  @ViewChild('projectMenu', {static: false}) projectMenu: TemplateRef<any>;
  overlayRef: OverlayRef | null;
  /** Hold subscribe function to click events on context menu */
  sub: Subscription;

  /**
   * List of projects owned by user
   */
  projects: Project[] = [];

  /**
   * Project in focus
   */
  selectedProject = null;

  /** vis ojbect to control network-graph vis */
  visGraph: NetworkVis = null;

  /** 
   * Decide if network graph is visualized
   * in full-screen or preview mode
   */
  screenMode: string = 'shrink';

  /** The edge or node focused on */
  focusedEntity: GraphSelectionData = null;

  get node() {
    if (!this.focusedEntity) return null;
    
    return this.focusedEntity['node_data'];
  }
  
  constructor(
    public dialog: MatDialog,
    private route: Router,
    private projectService: ProjectsService,
    private dataFlow: DataFlowService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef,
    private _snackBar: MatSnackBar
  ) { }

  ngOnInit() {}
  ngAfterViewInit() {
    this.projectService.pullProjects()
      .subscribe(data => {
        this.projects = data['projects'] as Project[];

        // Sort project by most recent modified date
        this.projects.sort(
          (a, b) => {
            return (a.date_modified < b.date_modified) ? -1 : ((a.date_modified > b.date_modified) ? 1 : 0);
          }
        );
        this.projects.reverse();
      });
  }

  /**
   * Switch between public or private mode
   * for the project
   */
  togglePublic() {
    let published = this.selectedProject.public;
    this.selectedProject.public = !published;
    
    this.projectService.updateProject(this.selectedProject)
      .subscribe(resp => {
        const state = this.selectedProject.public ? 'published' : 'private'

        this._snackBar.open(`Project is ${state}`, null, {
          duration: 2000,
        });
      });
  }

  /**
   * Allow user to navigate to a link in a new tab
   * @param hyperlink 
   */
  goToLink(hyperlink:string){
    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, "_blank");
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Spin up dialog to confirm if user wants to delete project,
   * if so, call delete API on project
   * @param project 
   */  
  deleteProject(project=null) {
    if (!project) project = this.selectedProject;

    const dialogRef = this.dialog.open(DeleteProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.projectService.deleteProject(project)
          .subscribe(resp => {

            this.projects = this.projects.filter(p => p.id !== project.id);

            if (project === this.selectedProject) {
              this.selectedProject = null;


              $('.list-view').animate({
                width: '100%'
              }, 400, () => {});
            }
          }
        );
      }
    });    
  }
  
  /**
   * Spin up dialog to confirm creation of project with
   * title and description, then call create API on project
   */
  createProject() {
    const dialogRef = this.dialog.open(CreateProjectDialogComponent, {
      width: '40%',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        let project = {
          ...result,
          graph: {
            nodes: [],
            edges: []
          },
          date_modified: new Date().toISOString()
        };

        this.projectService.addProject(project)
          .subscribe((data) => {
            this.projects.push(data['project']);
          });
      }
    }); 
  }
  
  /**
   * Make a duplicate of a project and its data with a new uid
   * through a confirmation dialog, then call create API on project
   * @param project 
   */
  copyProject(project: Project) {
    const dialogRef = this.dialog.open(CopyProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.projectService.addProject(result)
        .subscribe((data) => {
          this.projects.push(data['project']);
        });
    });
  }

  /**
   * Display selected project with graph preview
   * and meta-data
   * @param proj 
   */
  pickProject(proj: Project) {

    this.selectedProject = proj;

    setTimeout(
      () => {
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
      },
      100
    )
  }
  
  /**
   * Open project in drawing-tool view's canvas
   */
  goToProject() {
    this.dataFlow.pushProject2Canvas(this.selectedProject);
    this.route.navigateByUrl('dt/drawing-tool');
  }
  
  /**
   * Listen for click events from vis.js network
   * to handle certain events ..
   * - if a node is clicked on 
   * - if a edge is clicked on 
   * - if a node is clicked on during addMode
   * @param properties - edge or node entity clicked on
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
    } else {
      this.focusedEntity = null;
    }    
  }

  /**
   * Function handler for contextmenu click event
   * to spin up rendered contextmenu for project actions
   * @param event 
   * @param project 
   */
  open(event: MouseEvent, project) {
    // prevent event bubbling
    event.preventDefault();

    let x = event.x,
      y = event.y;

    // Close previous context menu if open
    this.close();

    // Position overlay to top right corner
    // of cursor context menu click
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
        }
      ]);
    
    // Create and render overlay near cursor position
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });

    this.overlayRef.attach(new TemplatePortal(this.projectMenu, this.viewContainerRef, {
      $implicit: project
    }));

    // Listen for click event after context menu has been
    // render on project item
    this.sub = fromEvent<MouseEvent>(document, 'click')
      .pipe(
        filter(event => {
          const clickTarget = event.target as HTMLElement;
          
          // Check if right click event
          let isRightClick = false;
          if ("which" in event) {
            isRightClick = event["which"] == 3;
          } else if ("button" in event) {
            isRightClick = event["button"] == 2;
          }

          // Return whether or not click event is on context menu or outside
          return !!this.overlayRef && !this.overlayRef.overlayElement.contains(clickTarget);
        }),
        take(1)
      ).subscribe(() => this.close())
  }
  
  /**
   * Close and remove the context menu
   * while unsubscribing from click streams
   * to it
   */
  close() {
    this.sub && this.sub.unsubscribe();
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }    
  }

  /**
   * Return other node connected to source in edge on a given edge
   * @param edge 
   */
  getNode(edge: VisNetworkGraphEdge) {
    return this.focusedEntity.other_nodes.filter(
      node => node.id === edge.to
    )[0].label;    
  }

  /** Zoom to all the nodes on canvas  */
  fit() {
    this.visGraph.zoom2All();
  }

  /** Switch between full-screen and preview mode of */
  toggle() {
    this.screenMode = this.screenMode === 'shrink' ? 'grow' : 'shrink';

    // Calculate the parameters for our animation 
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
}
