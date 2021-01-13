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

  dragStarted(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);

    // At this time, we don't support dragging multiple items
    this.objects.selectOnly(object);
  }

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent) {
    if (this.getTargetHashId(event) != null) {
      event.dataTransfer.dropEffect = 'move';
      event.preventDefault();
    }
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault();
    const targetHashId = this.getTargetHashId(event);
    const data = event.dataTransfer.getData(FILESYSTEM_OBJECT_TRANSFER_TYPE);
    if (targetHashId != null && data != null) {
      const transferData: FilesystemObjectTransferData = JSON.parse(data);

      const progressDialogRef = this.progressDialog.display({
        title: 'Working...',
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Moving...',
        })),
      });

      this.filesystemService.save([transferData.hashId], {
        parentHashId: targetHashId,
      }).pipe(
        tap(() => this.refreshRequest.emit()),
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create(),
      ).subscribe(() => {
        this.snackBar.open(`Moved item to new folder.`, 'Close', {
          duration: 5000,
        });
      });
    }
  }

  getTargetHashId(event: DragEvent): string | undefined {
    if (event.dataTransfer.types.includes(FILESYSTEM_OBJECT_TRANSFER_TYPE)) {
      const target = event.target;
      if ('closest' in target) {
        const acceptsDropElement = (event.target as Element).closest('[data-accepts-fs-drop]');
        if (acceptsDropElement) {
          if (acceptsDropElement.getAttribute('data-accepts-fs-drop') === '1') {
            return acceptsDropElement.getAttribute('data-fs-hash-id');
          }
        } else {
          return this.parent ? this.parent.hashId : null;
        }
      }
    }
    return null;
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
