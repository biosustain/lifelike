import { cloneDeep } from 'lodash';

import {
  Component, EventEmitter, ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import {
  ProjectsService,
  DataFlowService,
} from '../services';
import { Project } from '../services/interfaces';
import { MapCreateDialogComponent } from './map-create-dialog.component';
import { MapDeleteDialogComponent } from './map-delete-dialog.component';
import { MapCloneDialogComponent } from './map-clone-dialog.component';
import { MapUploadDialogComponent } from './map-upload-dialog.component';
import { MatSnackBar } from '@angular/material';

import { AuthenticationService } from 'app/auth/services/authentication.service';

import { AuthSelectors } from 'app/auth/store';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { first } from 'rxjs/operators';
import { DrawingUploadPayload } from 'app/interfaces/drawing.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { HttpEventType } from '@angular/common/http';
import { MapEditDialogComponent } from './map-edit-dialog.component';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MapListComponent } from './map-list.component';
import { MapPreviewComponent } from './map-preview.component';

@Component({
  selector: 'app-project-list-view',
  templateUrl: './map-browser.component.html',
  styleUrls: ['./map-browser.component.scss'],
})
export class MapBrowserComponent {
  @ViewChild('listComponent', {static: false}) listComponent: MapListComponent;
  @ViewChild('previewComponent', {static: false}) previewComponent: MapPreviewComponent;

  userRoles$: Observable<string[]>;

  /**
   * If true, then the map description box won't disappear.
   */
  infoPinned = true;

  /**
   * Map in focus.
   */
  selectedMap: Project = null;

  constructor(
    private readonly modalService: NgbModal,
    private route: Router,
    private workspaceManager: WorkspaceManager,
    private projectService: ProjectsService,
    private authService: AuthenticationService,
    private dataFlow: DataFlowService,
    private snackBar: MatSnackBar,
    private progressDialog: ProgressDialog,
    private store: Store<State>,
  ) {
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
  }

  /**
   * Update the map list.
   */
  refresh() {
    this.listComponent.refresh(false);
  }

  /**
   * Show the new map dialog.
   */
  displayCreateDialog() {
    const dialogRef = this.modalService.open(MapCreateDialogComponent);
    dialogRef.result.then(newMap => {
      this.projectService.addProject({
        ...newMap,
        date_modified: new Date().toISOString(),
      }).subscribe(() => {
        // TODO: Update API endpoint to return something useful
        this.selectedMap = null;
        this.refresh();
      });
    }, () => {
    });
  }

  /**
   * Show the map clone dialog.
   * @param map optional target map, otherwise currently selected map
   */
  displayCloneDialog(map: Project = null) {
    if (!map) {
      map = this.selectedMap;
    }

    const dialogRef = this.modalService.open(MapCloneDialogComponent);
    dialogRef.componentInstance.map = cloneDeep(map);
    dialogRef.result.then(newMap => {
      this.projectService.addProject({
        ...newMap,
        date_modified: new Date().toISOString(),
      }).subscribe((data) => {
        // TODO: Update API endpoint to return something useful
        this.selectedMap = null;
        this.refresh();
      });
    }, () => {
    });
  }

  /**
   * Show the map upload dialog.
   */
  displayUploadDialog() {
    const dialogRef = this.modalService.open(MapUploadDialogComponent);
    dialogRef.result.then((data: DrawingUploadPayload) => {
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
                status: 'Processing...',
                value: event.loaded / event.total,
              }));
            } else {
              progressObservable.next(new Progress({
                mode: ProgressMode.Determinate,
                status: 'Uploaded file...',
                value: event.loaded / event.total,
              }));
            }
          } else if (event.type === HttpEventType.Response) {
            progressDialogRef.close();
            this.snackBar.open(`File uploaded: ${data.filename}`, 'Close', {duration: 5000});
            const hashId = event.body.result.hashId;
            this.route.navigateByUrl(`map/edit/${hashId}`);
          }
        },
        err => {
          progressDialogRef.close();
          return throwError(err);
        });
    });
  }

  /**
   * Open edit dialog for the map.
   * @param map optional target map, otherwise currently selected map
   */
  displayEditDialog(map: Project | undefined = null) {
    if (!map) {
      map = this.selectedMap;
    }

    const dialogRef = this.modalService.open(MapEditDialogComponent);
    dialogRef.componentInstance.map = cloneDeep(map);
    dialogRef.result.then(newMap => {
      this.projectService.updateProject(newMap)
        .subscribe(() => {
          this.selectedMap = newMap;
          this.refresh();
        });
    }, () => {
    });
  }

  /**
   * Open delete confirmation dialog for the map.
   * @param map optional target map, otherwise currently selected map
   */
  displayDeleteDialog(map: Project | undefined = null) {
    if (!map) {
      map = this.selectedMap;
    }

    const dialogRef = this.modalService.open(MapDeleteDialogComponent);
    dialogRef.componentInstance.map = cloneDeep(map);
    dialogRef.result.then(() => {
      this.projectService.deleteProject(map).subscribe(() => {
        if (map === this.selectedMap) {
          this.selectedMap = null;
        }
        this.refresh();
      });
    }, () => {
    });
  }

  /**
   * Downloads the selected project as a JSON file
   * @param map optional target map, otherwise currently selected map
   * TODO: Only admin feature at the moment. Enable for all users?
   */
  download(map: Project | undefined = null) {
    if (!map) {
      map = this.selectedMap;
    }

    this.projectService.downloadProject(map.hash_id).pipe(first()).subscribe((payload) => {
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
      link.download = this.selectedMap.label + '.json';
      // this is necessary as link.click() does not work on the latest firefox
      link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));

      setTimeout(() => {
        // For Firefox it is necessary to delay revoking the ObjectURL
        window.URL.revokeObjectURL(data);
        link.remove();
      }, 100);
    });
  }

  /**
   * Open the map in the editor.
   * @param map optional target map, otherwise currently selected map
   */
  edit(map: Project | undefined = null) {
    if (!map) {
      map = this.selectedMap;
    }

    this.workspaceManager.navigateByUrl(`map/edit/${map.hash_id}`);
  }

  /**
   * Get whether the currently selected project is owned by the user.
   */
  get mayEditSelectedMap() {
    return this.selectedMap != null && this.authService.whoAmI() === this.selectedMap.user_id;
  }

  /**
   * Zoom the map preview to fit.
   */
  zoomToFit() {
    this.previewComponent.graphCanvas.zoomToFit(1000);
  }
}
