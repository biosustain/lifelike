import {
  Component,
  ViewChild,
  TemplateRef,
  ViewContainerRef, OnInit
} from '@angular/core';
import {
  MatDialog
} from '@angular/material/dialog';
import {Router} from '@angular/router';
import {OverlayRef, Overlay} from '@angular/cdk/overlay';
import {Subscription, fromEvent} from 'rxjs';
import {TemplatePortal} from '@angular/cdk/portal';
import {filter, take} from 'rxjs/operators';

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
import {MatSnackBar, MatTabChangeEvent} from '@angular/material';

import * as $ from 'jquery';

import {isNullOrUndefined} from 'util';
import {AuthenticationService} from 'app/auth/services/authentication.service';

@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent {
  fullScreenmode = 'shrink';

  /**
   * ID of the user
   */
  userId;

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

  displayIndex = 0;

  get emptyGraph() {
    if (!this.selectedProject) {
      return true;
    }

    return this.selectedProject.graph.nodes.length ? false : true;
  }

  get isItMine() {
    if (!this.selectedProject) {
      return false;
    }
    return this.userId === this.selectedProject.user_id;
  }

  constructor(
    public dialog: MatDialog,
    private route: Router,
    private projectService: ProjectsService,
    private authService: AuthenticationService,
    private dataFlow: DataFlowService,
    private snackBar: MatSnackBar
  ) {
    this.userId = this.authService.whoAmI();
    this.refresh();
  }

  /**
   * Pull projects from server both
   * personal and community
   */
  refresh() {
    // TODO: Sort projects
    this.projectService.pullProjects()
      .subscribe(data => {
        this.projects = (
          data.projects as Project[]
        );
      });
    this.projectService.pullCommunityProjects()
      .subscribe(data => {
        this.publicProjects = (
          /* tslint:disable:no-string-literal */
          data['projects'] as Project[]
        );
      });
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
   * Spin up dialog to confirm if user wants to delete project,
   * if so, call delete API on project
   * @param project represents a project object
   */
  deleteProject(project = null) {
    if (!project) {
      project = this.selectedProject;
    }

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
                }, 400, () => {
                });
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
              this.projects = this.projects.concat([data.project]);
            });
      }
    });
  }

  /**
   * Make a duplicate of a project and its data with a new uid
   * through a confirmation dialog, then call create API on project
   * @param project represents a project object
   */
  copyProject(project: Project = null) {
    if (!project) {
      project = this.selectedProject;
    }

    const dialogRef = this.dialog.open(CopyProjectDialogComponent, {
      width: '40%',
      data: project
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }

      this.projectService.addProject(result)
        .subscribe((data) => {
          this.projects = this.projects.concat([data.project]);
        });
    });
  }

  /**
   * Display selected project with graph preview
   * and meta-data
   * @param project represents a project object
   */
  pickProject(proj: Project) {
    this.selectedProject = proj;
  }


  /**
   * Open project in drawing-tool view's canvas
   */
  goToProject() {
    this.dataFlow.pushProject2Canvas(this.selectedProject);
    this.route.navigateByUrl('dt/splitter');
  }

  handleAPI(evt: { action: string, project: Project }) {

    switch (evt.action) {
      case 'pick':
        this.pickProject(evt.project);
        break;
      case 'delete':
        this.deleteProject(evt.project);
        break;
      case 'copy':
        this.copyProject(evt.project);
        break;
      default:
        break;
    }
  }

  toggleFullscreen(screenMode) {
    this.fullScreenmode = screenMode;
    console.log(this.fullScreenmode);
  }

  goToSearch() {
    this.displayIndex = 2;
  }
}
