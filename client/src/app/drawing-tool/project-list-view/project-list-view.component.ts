import {
  Component,
} from '@angular/core';
import {
  MatDialog
} from '@angular/material/dialog';
import {Router} from '@angular/router';

import {
  ProjectsService,
  DataFlowService,
} from '../services';
import {
  Project,
} from '../services/interfaces';
import {
  CreateProjectDialogComponent
} from './create-project-dialog/create-project-dialog.component';
import {
  DeleteProjectDialogComponent
} from './delete-project-dialog/delete-project-dialog.component';
import {
  CopyProjectDialogComponent
} from './copy-project-dialog/copy-project-dialog.component';
import {
 UploadProjectDialogComponent
} from './upload-project-dialog/upload-project-dialog.component';
import {MatSnackBar} from '@angular/material';

import * as $ from 'jquery';

import {AuthenticationService} from 'app/auth/services/authentication.service';

import { AuthSelectors } from 'app/auth/store';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { first } from 'rxjs/operators';
import { DrawingUploadPayload } from 'app/interfaces/drawing.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { HttpEventType } from '@angular/common/http';
import { EditProjectDialogComponent } from '../project-list/edit-project-dialog/edit-project-dialog.component';


@Component({
  selector: 'app-project-list-view',
  templateUrl: './project-list-view.component.html',
  styleUrls: ['./project-list-view.component.scss']
})
export class ProjectListViewComponent {
  fullScreenmode = 'shrink';

  userRoles$: Observable<string[]>;

  uploadStarted = false;

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
    private snackBar: MatSnackBar,
    private progressDialog: ProgressDialog,
    private store: Store<State>,
  ) {
    this.userId = this.authService.whoAmI();
    this.refresh();
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
  }

  /**
   * Pull projects from server both
   * personal and community
   */
  refresh() {
    // TODO: Sort projects by modified date
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
   * Spin up dialog to allow user to update meta-data of project
   */
  editProject() {
    const dialogRef = this.dialog.open(EditProjectDialogComponent, {
      width: '40%',
      data: this.selectedProject
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }

      this.selectedProject = result;

      this.projectService.updateProject(this.selectedProject)
        .subscribe(
          data => {
            this.projects = this.projects.map(
              (proj: Project) => {
                if (proj.hash_id === this.selectedProject.hash_id) {
                  return this.selectedProject;
                } else {
                  return proj;
                }
              }
            );

            this.snackBar.open(`Project is updated`, null, {
              duration: 2000,
            });
          }
        );
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
   * Uploads a drawing project from a JSON file
   * TODO: Set as user feature? This is only for admins at the moment
   */
  uploadProject() {
    const dialogRef = this.dialog.open(UploadProjectDialogComponent, {
      width: '40%',
      data: {},
    });

    dialogRef.afterClosed().subscribe((data: DrawingUploadPayload) => {
      if (data) {
        this.upload(data);
      }
    });
  }

  upload(data: DrawingUploadPayload) {
    // The user shouldn't be able to initiate a new file upload
    if (this.uploadStarted) { return; }
    this.uploadStarted = true;

    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing file for upload...',
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Adding ${data.filename}`,
      progressObservable,
    });

    this.projectService.uploadProject(data).subscribe(event => {
      if (event.type === HttpEventType.UploadProgress) {
        if (event.loaded >= event.total) {
          progressObservable.next(new Progress({
            mode: ProgressMode.Buffer,
            status: 'Creating annotations in file...',
            value: event.loaded / event.total
          }));
        } else {
          progressObservable.next(new Progress({
            mode: ProgressMode.Determinate,
            status: 'Uploaded file...',
            value: event.loaded / event.total
          }));
        }
      } else if (event.type === HttpEventType.Response) {
        progressDialogRef.close();
        this.uploadStarted = false;
        this.snackBar.open(`File uploaded: ${data.filename}`, 'Close', {duration: 5000});
        const hashId = event.body.result.hashId;
        this.route.navigateByUrl(`dt/splitter/${hashId}`);
      }
    },
    err => {
      progressDialogRef.close();
      this.uploadStarted = false;
      return throwError(err);
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
   * Downloads the selected project as a JSON file
   * TODO: Only admin feature at the moment. Enable for all users?
   */
  downloadProject() {
    this.projectService.downloadProject(
      this.selectedProject.hash_id).pipe(first()).subscribe((payload) => {
        const jsonData = JSON.stringify(payload);
        const blob = new Blob([jsonData], {type: 'text/json'});

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(blob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = data;
        link.download = this.selectedProject.label + '.json';
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
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
    this.route.navigateByUrl(`dt/splitter/${this.selectedProject.hash_id}`);
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
