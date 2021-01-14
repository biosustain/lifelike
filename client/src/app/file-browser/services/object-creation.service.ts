import { AnnotationGenerationRequest, ObjectCreateRequest } from '../schema';
import { BehaviorSubject, Observable } from 'rxjs';
import { FilesystemObject } from '../models/filesystem-object';
import { Progress, ProgressMode } from '../../interfaces/common-dialog.interface';
import { filter, finalize, map, mergeMap, tap } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../components/dialog/object-edit-dialog.component';
import { Injectable } from '@angular/core';
import { AnnotationsService } from './annotations.service';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { FilesystemService } from './filesystem.service';

@Injectable()
export class ObjectCreationService {

  constructor(protected readonly annotationsService: AnnotationsService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly route: ActivatedRoute,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService) {
  }

  /**
   * Handles the filesystem PUT request with a progress dialog.
   * @param request the request data
   * @param annotationOptions options for the annotation process
   * @return the created object
   */
  protected executePutWithProgressDialog(request: ObjectCreateRequest,
                                         annotationOptions: AnnotationGenerationRequest = {}):
    Observable<FilesystemObject> {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing...',
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${request.filename}'`,
      progressObservable,
    });

    return this.filesystemService.create(request)
      .pipe(
        tap(event => {
          // First we show progress for the upload itself
          if (event.type === HttpEventType.UploadProgress) {
            if (event.loaded === event.total && event.total) {
              progressObservable.next(new Progress({
                mode: ProgressMode.Indeterminate,
                status: 'File transmitted; saving...',
              }));
            } else {
              progressObservable.next(new Progress({
                mode: ProgressMode.Determinate,
                status: 'Transmitting file...',
                value: event.loaded / event.total,
              }));
            }
          }
        }),
        filter(event => event.bodyValue != null),
        map((event): FilesystemObject => event.bodyValue),
        mergeMap((object: FilesystemObject) => {
          // Then we show progress for the annotation generation (although
          // we can't actually show a progress percentage)
          progressObservable.next(new Progress({
            mode: ProgressMode.Indeterminate,
            status: 'Saved; identifying annotations...',
          }));
          return this.annotationsService.generateAnnotations(
            [object.hashId], annotationOptions,
          ).pipe(
            map(() => object), // This method returns the object
          );
        }),
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create(),
      );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: CreateDialogOptions = {}): Promise<FilesystemObject> {
    const dialogRef = this.modalService.open(ObjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New File';
    dialogRef.componentInstance.object = target;
    const keys: Array<keyof CreateDialogOptions> = [
      'promptUpload',
      'promptAnnotationOptions',
      'forceAnnotationOptions',
      'promptParent',
      'parentLabel',
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = ((value: ObjectEditDialogValue) => {
      return this.executePutWithProgressDialog({
        ...value.request,
        ...(options.request || {}),
      }, {
        annotationMethod: value.annotationMethod,
        organism: value.organism,
      }).toPromise();
    });
    return dialogRef.result;
  }

}

export interface CreateDialogOptions {
  title?: string;
  promptUpload?: boolean;
  promptAnnotationOptions?: boolean;
  forceAnnotationOptions?: boolean;
  promptParent?: boolean;
  parentLabel?: string;
  request?: Partial<ObjectCreateRequest>;
}
