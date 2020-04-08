import {
  Component,
  ViewChild,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import {
  MatDialog
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OverlayRef, Overlay } from '@angular/cdk/overlay';
import { Subscription, fromEvent } from 'rxjs';
import { TemplatePortal } from '@angular/cdk/portal';
import { filter, take } from 'rxjs/operators';

import {
  ProjectsService,
  DataFlowService,
} from '../services';
import {
  Project,
  VisNetworkGraphEdge,
  GraphSelectionData
} from '../services/interfaces';
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
import { MatSnackBar, MatTabChangeEvent } from '@angular/material';

import * as $ from 'jquery';

/**
 * Sort project by most recent modified date
 * @param a - item to sort
 * @param b - item to sort against
 */
const sort = (a: Project, b: Project) => {
  if (
    a.date_modified < b.date_modified
  ) {
    return 1;
  } else if (
    a.date_modified === b.date_modified
  ) {
    return 0;
  } else {
    return -1;
  }
};
import { isNullOrUndefined } from 'util';

@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent {
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
   * List of projects made public
   */
  publicProjects: Project[] = [];

  /**
   * Project in focus
   */
  selectedProject: Project = null;

  /** vis ojbect to control network-graph vis */
  visGraph: NetworkVis = null;

  /**
   * Decide if network graph is visualized
   * in full-screen or preview mode
   */
  screenMode = 'shrink';

  /** The edge or node focused on */
  focusedEntity: GraphSelectionData = null;

  /** Whether to show community or personal maps */
  privateDisplayMode = 'personal';
  displayIndex = 0;

  get displayMode() {
    return this.privateDisplayMode;
  }
  set displayMode(val) {
    this.privateDisplayMode = val;
    this.displayIndex = val === 'personal' ? 0 : 1;
    this.projects.sort(sort);
  }

  get node() {
    if (!this.focusedEntity) { return null; }

    return this.focusedEntity.nodeData;
  }

  get emptyGraph() {
    if (!this.selectedProject) { return true; }

    return this.selectedProject.graph.nodes.length ? false : true;
  }

  constructor(
    public dialog: MatDialog,
    private route: Router,
    private projectService: ProjectsService,
    private dataFlow: DataFlowService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef,
    private snackBar: MatSnackBar
  ) {
    this.refresh();
  }

  /**
   * Pull projects from server both
   * personal and community
   */
  refresh() {
    this.projectService.pullProjects()
      .subscribe(data => {
        this.projects = (
          data.projects as Project[]
        ).sort(sort);
      });
    this.projectService.pullCommunityProjects()
      .subscribe(data => {
        this.publicProjects = (
          /* tslint:disable:no-string-literal */
          data['projects'] as Project[]
        ).sort(sort);
      });
  }

  /**
   * Switch between personal or community view
   */
  toggleView(tab: MatTabChangeEvent) {
    this.selectedProject = null;
    this.displayMode = tab.tab.textLabel.toLocaleLowerCase();
  }

  /**
   * Switch between public or private mode
   * for the project
   */
  togglePublic() {
    const published = this.selectedProject.public;
    this.selectedProject.public = !published;

    this.projectService.updateProject(this.selectedProject)
      .subscribe(resp => {
        const state = this.selectedProject.public ? 'published' : 'private';

        this.snackBar.open(`Project is ${state}`, null, {
          duration: 2000,
        });

        this.refresh();
      });
  }

  /**
   * Allow user to navigate to a link in a new tab
   * @param hyperlink - the linkto navigate to
   */
  goToLink(hyperlink: string) {
    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Spin up dialog to confirm if user wants to delete project,
   * if so, call delete API on project
   * @param project represents a project object
   */
  deleteProject(project= null) {
    if (!project) { project = this.selectedProject; }

    const dialogRef = this.dialog.open(DeleteProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.projectService.deleteProject(project)
          .subscribe(resp => {

            this.projects = this.projects.filter(p => p.id !== project.id);
            this.publicProjects = this.publicProjects.filter(p => p.id !== project.id);

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
        const project = {
          ...result,
          graph: {
            nodes: [],
            edges: []
          },
          date_modified: new Date().toISOString()
        };

        this.projectService.addProject(project)
          .subscribe(
            (data) => {
              this.projects.push(data.project);
              this.displayMode = 'personal';
          });
      }
    });
  }

  /**
   * Make a duplicate of a project and its data with a new uid
   * through a confirmation dialog, then call create API on project
   * @param project represents a project object
   */
  copyProject(project: Project= null) {
    if (!project) { project = this.selectedProject; }

    const dialogRef = this.dialog.open(CopyProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) { return; }

      this.projectService.addProject(result)
        .subscribe((data) => {
          this.projects.push(data.project);
          this.displayMode = 'personal';
        });
    });
  }

  /**
   * Display selected project with graph preview
   * and meta-data
   * @param proj represents a project object
   */
  pickProject(proj: Project) {
    if (this.overlayRef) { return; }

    this.selectedProject = proj;

    setTimeout(
      () => {
        const container = document.getElementById('canvas');
        this.visGraph = new NetworkVis(container);

        const g = this.projectService.universe2Vis(proj.graph);

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
        );
      },
      100
    );
  }


  /**
   * Open project in drawing-tool view's canvas
   */
  goToProject() {
    this.dataFlow.pushProject2Canvas(this.selectedProject);
    this.route.navigateByUrl('splitter');
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
      const nodeId = properties.nodes[0];
      this.focusedEntity = this.visGraph.getNode(nodeId);
    } else if (properties.edges.length) {
      // If an edge is clicked on
      // do nothing ..
    } else {
      this.focusedEntity = null;
    }
  }

  /**
   * Function handler for contextmenu click event
   * to spin up rendered contextmenu for project actions
   * @param event represents a oncontext event
   * @param project represents a project object
   */
  open(event: MouseEvent, project) {
    // prevent event bubbling
    event.preventDefault();

    const {x, y} = event;

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
        filter(mouseEvent => {
          const clickTarget = mouseEvent.target as HTMLElement;

          // TODO: Not sure what the purpose of this is?
          // Check if right click event
          //   let isRightClick = false;
          //   if ('which' in mouseEvent) {
          //     isRightClick = mouseEvent.which === 3;
          //   } else if ('button' in event) {
          //     isRightClick = mouseEvent.button === 2;
          //   }

          // Return whether or not click event is on context menu or outside
          return !!this.overlayRef && !this.overlayRef.overlayElement.contains(clickTarget);
        }),
        take(1)
      ).subscribe(() => this.close());
  }

  /**
   * Close and remove the context menu
   * while unsubscribing from click streams
   * to it
   */
  close() {
    if (!isNullOrUndefined(this.sub)) {
        this.sub.unsubscribe();
    }
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  /**
   * Return other node connected to source in edge on a given edge
   * @param edge - represent edge from vis.js network
   */
  getNode(edge: VisNetworkGraphEdge) {
    return this.focusedEntity.otherNodes.filter(
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
    const listWidth = this.screenMode === 'shrink' ? '25%' : '0%';
    const previewWidth = this.screenMode === 'shrink' ? '75%' : '100%';
    const listDuration = this.screenMode === 'shrink' ? 500 : 400;
    const previewDuration = this.screenMode === 'shrink' ? 400 : 500;
    const containerHeight = this.screenMode === 'shrink' ? '70vh' : '100vh';
    const panelHeight = this.screenMode === 'shrink' ? '30vh' : '0vh';

    $('#map-list-container').animate({width: listWidth}, listDuration);
    $('#map-preview').animate({width: previewWidth}, previewDuration);

    $('#canvas-container').animate({height: containerHeight}, 600);
    $('#map-panel').animate({height: panelHeight}, 600);
  }
}
