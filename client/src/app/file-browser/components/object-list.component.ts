import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { nullCoalesce } from '../../shared/utils/types';
import { uniqueId } from 'lodash';
import { CollectionModel } from '../../shared/utils/collection-model';
import { getObjectLabel } from '../utils/objects';
import { FILESYSTEM_OBJECT_TRANSFER_TYPE, FilesystemObjectTransferData } from '../data';
import { FilesystemService } from '../services/filesystem.service';
import { BehaviorSubject } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { Progress } from '../../interfaces/common-dialog.interface';

@Component({
  selector: 'app-object-list',
  templateUrl: './object-list.component.html',
})
export class ObjectListComponent {
  id = uniqueId('FileListComponent-');

  @Input() appLinks = false;
  @Input() forEditing = true;
  @Input() showDescription = false;
  @Input() parent: FilesystemObject | undefined;
  @Input() objects: CollectionModel<FilesystemObject> | undefined;
  @Input() objectControls = true;
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();

  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions,
              protected readonly filesystemService: FilesystemService,
              protected readonly elementRef: ElementRef,
              protected readonly progressDialog: ProgressDialog) {
  }

  objectDragStart(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);

    // At this time, we don't support dragging multiple items
    this.objects.selectOnly(object);
  }

  getDateShown(object: DirectoryObject) {
    return nullCoalesce(object.modificationDate, object.creationDate);
  }

  openParentEditDialog() {
    return this.actions.openEditDialog(this.parent).then(() => {
      this.snackBar.open(`Saved changes to ${getObjectLabel(this.parent)}.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }
}
