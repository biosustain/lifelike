import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject } from 'rxjs';
import { finalize, tap, first, map } from 'rxjs/operators';

import { ProgressDialog } from 'app/shared/modules/dialog/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import {
  MessageArguments,
  MessageDialog,
} from 'app/shared/modules/dialog/services/message-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import {
  FILESYSTEM_OBJECT_TRANSFER_TYPE,
  FilesystemObjectTransferData,
} from 'app/file-browser/providers/filesystem-object-data.provider';

import { extractDescriptionFromFile } from '../../../utils/files';

@Directive({
  selector: '[appFSObjectTarget]',
})
export class FilesystemObjectTargetDirective {
  @HostBinding('attr.data-filesystem-object-target-directive') _dataMarker = true;
  @HostBinding('class.drop-target') dropTargeted = false;
  @Input() appFSObjectTarget: FilesystemObject | undefined;
  @Output() refreshRequest = new EventEmitter<any>();

  constructor(
    protected readonly progressDialog: ProgressDialog,
    protected readonly filesystemService: FilesystemService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly snackBar: MatSnackBar,
    protected readonly elementRef: ElementRef,
    protected readonly objectCreationService: ObjectCreationService,
    protected readonly messageDialog: MessageDialog
  ) {}

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent) {
    this.dropTargeted = this.canAcceptDrop(event);
    if (this.dropTargeted) {
      event.dataTransfer.dropEffect = 'move';
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('dragleave', ['$event'])
  dragLeave(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('body:***ARANGO_DB_NAME***objectupdate', ['$event'])
  async ***ARANGO_DB_NAME***ObjectUpdate(event) {
    if (this.appFSObjectTarget) {
      if (await this.isAffectedObject(event.detail.hashId)) {
        this.refreshRequest.emit();
      }
    }
  }

  @HostListener('drop', ['$event'])
  async drop(event: DragEvent) {
    this.dropTargeted = false;

    const valid = this.canAcceptDrop(event);
    if (valid) {
      event.preventDefault();
      event.stopPropagation();

      const data = event.dataTransfer.getData(FILESYSTEM_OBJECT_TRANSFER_TYPE);
      if (data !== '') {
        const transferData: FilesystemObjectTransferData = JSON.parse(data);

        if (transferData.privileges.writable) {
          const progressDialogRef = this.progressDialog.display({
            title: 'File Move',
            progressObservables: [
              new BehaviorSubject<Progress>(
                new Progress({
                  status: 'Moving to the new folder...',
                })
              ),
            ],
          });

          this.filesystemService
            .save([transferData.hashId], {
              parentHashId: this.appFSObjectTarget.hashId,
            })
            .pipe(
              tap(() => {
                const affectedHashIds = new Set([
                  transferData.hashId,
                  this.appFSObjectTarget.hashId,
                ]);
                for (const hashId of affectedHashIds) {
                  document.body.dispatchEvent(
                    new CustomEvent('***ARANGO_DB_NAME***objectupdate', {
                      detail: {
                        hashId,
                      },
                    })
                  );
                }
              }),
              finalize(() => progressDialogRef.close()),
              this.errorHandler.create({ label: 'Move object from drag and drop' })
            )
            .subscribe(() => {
              this.snackBar.open(`Moved item to new folder.`, 'Close', {
                duration: 5000,
              });
            });
        } else {
          this.messageDialog.display({
            title: 'Cannot Move Here',
            message: 'You do not have permission to put files here.',
            type: MessageType.Error,
          } as MessageArguments);
        }
      } else if (event.dataTransfer.files.length) {
        const file = event.dataTransfer.files[0];
        const object = new FilesystemObject();
        object.filename = file.name;
        object.parent = this.appFSObjectTarget;
        object.description = await extractDescriptionFromFile(file);
        return this.objectCreationService
          .openCreateDialog(object, {
            title: 'Upload File',
            promptUpload: false,
            promptParent: true,
            forceAnnotationOptions: true, // This is not correct (we should detect this value)
            request: {
              contentValue: file,
            },
          })
          .then((value) => {
            this.refreshRequest.emit();
            return value;
          });
      }
    }
  }

  isAffectedObject(hashId: string): Promise<boolean> | boolean {
    if (hashId === this.appFSObjectTarget.hashId) {
      return true;
    }
    return this.appFSObjectTarget.children.items$
      .pipe(
        first(),
        map((items) => items.some((item) => item.hashId === hashId))
      )
      .toPromise();
  }

  canAcceptDrop(event: DragEvent): boolean {
    return (
      this.appFSObjectTarget != null &&
      this.appFSObjectTarget.privileges.writable &&
      ((event.dataTransfer.types.includes(FILESYSTEM_OBJECT_TRANSFER_TYPE) &&
        event.target instanceof Element &&
        (event.target === this.elementRef.nativeElement ||
          event.target.closest('[data-filesystem-object-target-directive]') ===
            this.elementRef.nativeElement)) ||
        (event.dataTransfer.types && event.dataTransfer.types.includes('Files')))
    );
  }
}