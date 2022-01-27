import { HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import {BehaviorSubject, Observable, iif, of, merge, pipe, from, EMPTY, forkJoin} from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  finalize,
  map,
  mergeMap,
  switchMap,
  tap
} from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ResultMapping } from 'app/shared/schemas/common';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

import { PDFAnnotationGenerationRequest, ObjectCreateRequest, AnnotationGenerationResultData } from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../components/dialog/object-edit-dialog.component';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';

@Injectable()
export class ObjectCreationService {

  private subscription;

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
   * TODO: Refactor into smaller functions
   * Handles the filesystem PUT request with a progress dialog.
   * @param requests the request data
   * @param annotationOptions options for the annotation process
   * @return the created object
   */
  executePutWithProgressDialog(requests: ObjectCreateRequest[],
                               annotationOptions: PDFAnnotationGenerationRequest[]):
    Observable<FilesystemObject>[] {
    const progressObservable = [];
    for (const req of requests) {
      progressObservable.push(new BehaviorSubject<Progress>(new Progress({
    status: `Preparing ${req.filename || 'file'}`,
  })));
    }
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${requests.length > 1 ? 'Files' : requests[0].filename}'`,
      progressObservable,
    });
    const promiseList = [];
    for (let i = 0; i < requests.length; i++) {
      let results: [FilesystemObject[], ResultMapping<AnnotationGenerationResultData>[]] = null;
      const request = requests[i];
      promiseList.push(this.filesystemService.create(request)
      .pipe(
        tap(event => {
          // First we show progress for the upload itself
          if (event.type === HttpEventType.UploadProgress) {
            if (event.loaded === event.total && event.total) {
              progressObservable[i].next(new Progress({
                mode: ProgressMode.Indeterminate,
                status: 'File transmitted; saving...',
              }));
            } else {
              progressObservable[i].next(new Progress({
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
          progressObservable[i].next(new Progress({
            mode: ProgressMode.Indeterminate,
            status: 'Saved; Parsing and identifying annotations...',
          }));
          const annotationsService = this.annotationsService.generateAnnotations(
            [object.hashId], annotationOptions[i] || {},
          ).pipe(map(res => {
            const check = Object.entries(res.mapping).map(r => r[1].success);
            if (check.some(c => c === false)) {
                results = [[object], [res]];
                const modalRef = this.modalService.open(ObjectReannotateResultsDialogComponent);
                modalRef.componentInstance.objects = results[0];
                modalRef.componentInstance.results = results[1];
            }
            return object;
          }));
          return iif(
            () => object.isAnnotatable,
            merge(annotationsService),
            of(object)
          );
        }),
        this.errorHandler.create({label: 'Create object'}),
      ));
    }
    this.subscription = forkJoin(promiseList).subscribe(_ => {
      progressDialogRef.close();
    }, ( error ) => {
      progressDialogRef.close();
    });
    return promiseList;
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
      const requests = value.uploadRequests.length ? value.uploadRequests : [value.request];
      return this.executePutWithProgressDialog(requests, [])[0].toPromise();
    });
    return dialogRef.result;
  }

}

export interface CreateDialogOptions {
  title?: string;
  promptUpload?: boolean;
  forceAnnotationOptions?: boolean;
  promptParent?: boolean;
  parentLabel?: string;
  request?: Partial<ObjectCreateRequest>;
}
