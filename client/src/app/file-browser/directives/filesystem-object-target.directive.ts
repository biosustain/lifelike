import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { FILESYSTEM_OBJECT_TRANSFER_TYPE, FilesystemObjectTransferData } from '../data';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { finalize, tap } from 'rxjs/operators';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { FilesystemService } from '../services/filesystem.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ObjectCreationService } from '../services/object-creation.service';
import { FilesystemObject } from '../models/filesystem-object';

@Directive({
  selector: '[appFSObjectTarget]',
})
export class FilesystemObjectTargetDirective {

  @HostBinding('attr.data-filesystem-object-target-directive') _dataMarker = true;
  @HostBinding('class.drop-target') dropTargeted = false;
  @Input() appFSObjectTarget: FilesystemObject | undefined;
  @Output() refreshRequest = new EventEmitter<any>();

  constructor(protected readonly progressDialog: ProgressDialog,
              protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly elementRef: ElementRef,
              protected readonly objectCreationService: ObjectCreationService) {
  }

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent) {
    this.dropTargeted = this.canAcceptDrop(event);
    if (this.dropTargeted) {
      event.dataTransfer.dropEffect = 'move';
      event.preventDefault();
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

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault();
    this.dropTargeted = false;

    const valid = this.canAcceptDrop(event);
    if (valid) {
      const data = event.dataTransfer.getData(FILESYSTEM_OBJECT_TRANSFER_TYPE);
      if (data !== '') {
        const transferData: FilesystemObjectTransferData = JSON.parse(data);

        const progressDialogRef = this.progressDialog.display({
          title: 'Working...',
          progressObservable: new BehaviorSubject<Progress>(new Progress({
            status: 'Moving...',
          })),
        });

        this.filesystemService.save([transferData.hashId], {
          parentHashId: this.appFSObjectTarget.hashId,
        }).pipe(
          tap(() => this.refreshRequest.emit()),
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create(),
        ).subscribe(() => {
          this.snackBar.open(`Moved item to new folder.`, 'Close', {
            duration: 5000,
          });
        });
      } else if (event.dataTransfer.files.length) {
        const file = event.dataTransfer.files[0];
        const object = new FilesystemObject();
        object.filename = file.name;
        object.parent = this.appFSObjectTarget;
        return this.objectCreationService.openCreateDialog(object, {
          title: 'Upload File',
          promptUpload: false,
          promptParent: true,
          promptAnnotationOptions: true,
          forceAnnotationOptions: true, // This is not correct (we should detect this value)
          request: {
            contentValue: file,
          },
        });
      }
    }
  }

  canAcceptDrop(event: DragEvent): boolean {
    return this.appFSObjectTarget != null
      && this.appFSObjectTarget.privileges.writable
      && ((
        event.dataTransfer.types.includes(FILESYSTEM_OBJECT_TRANSFER_TYPE)
        && event.target instanceof Element
        && (event.target === this.elementRef.nativeElement
          || event.target.closest('[data-filesystem-object-target-directive]') === this.elementRef.nativeElement)
      )
      || (
        event.dataTransfer.types
        && event.dataTransfer.types.includes('Files')
      ));
  }

}
