import { HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, iif, of, merge } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ResultMapping } from 'app/shared/schemas/common';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

import { PDFAnnotationGenerationRequest, ObjectCreateRequest, AnnotationGenerationResultData } from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';
import { ObjectUploadDialogComponent } from '../components/dialog/object-upload-dialog.component';

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
   * Wrapper around put - enrichment tables require the return to be a single file.
   * Even though this would never return an array, we need this code to make TypeScript happy.
   * @param request the request data
   * @param annotationOptions options for the annotation process
   * @return the created object
   */
  executeSinglePutWithProgressDialog(request: ObjectCreateRequest,
                                     annotationOptions: PDFAnnotationGenerationRequest):
  Promise<FilesystemObject> {
    return this.executePutWithProgressDialog([request], [annotationOptions])
      .then( value => {
        return Array.isArray(value) ? value[0] : value;
    });
  }
  /**
   * Handles the filesystem PUT request(s) with a progress dialog.
   * @param requests the request(s) data
   * @param annotationOptions options for the annotation process(es)
   * @return the created object(s)
   */
  executePutWithProgressDialog(requests: ObjectCreateRequest[],
                               annotationOptions: PDFAnnotationGenerationRequest[]):
    Promise<FilesystemObject[]> {
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
    let results: [FilesystemObject[], ResultMapping<AnnotationGenerationResultData>[]] = null;
    const promiseList: Promise<FilesystemObject>[] = [];
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const annotationOption = annotationOptions[i] || {};
      promiseList.push(this.filesystemService.create(request)
      .pipe(
        tap(event => {
          // First we show progress for the upload itself
          if (event.type === HttpEventType.UploadProgress) {
            if (event.loaded === event.total && event.total) {
              progressObservable[i].next(new Progress({
                mode: ProgressMode.Indeterminate,
                status: `${request.filename || 'File'} transmitted; saving...`,
              }));
            } else {
              progressObservable[i].next(new Progress({
                mode: ProgressMode.Determinate,
                status: `Transmitting ${request.filename || 'file' }...`,
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
            status: `${request.filename || 'file'} saved; Parsing and identifying annotations...`,
          }));
          const annotationsService = this.annotationsService.generateAnnotations(
            [object.hashId], annotationOption || {},
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
        this.errorHandler.create({label: 'Create object'})
      ).toPromise());
    }

    let finalPromise;
    if (promiseList.length === 1) {
      finalPromise = promiseList[0];
    } else {
      finalPromise = Promise.race(promiseList);
    }
    this.subscription = finalPromise.then(_ => {
      progressDialogRef.close();
    }, ( error ) => {
      progressDialogRef.close();
      console.error(error);
    });
    return finalPromise;
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: CreateDialogOptions = {}): Promise<FilesystemObject> {
    const dialogRef = this.modalService.open(ObjectUploadDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New File';
    dialogRef.componentInstance.object = target;
    const keys: Array<keyof CreateDialogOptions> = [
      'promptUpload',
      'forceAnnotationOptions',
      'promptParent',
      'parentLabel',
      'request'
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = ((requests: ObjectCreateRequest[]) => {
      const annotationOptions: PDFAnnotationGenerationRequest[] = requests.map(request => ({
        organism: request.fallbackOrganism,
        annotationConfigs: request.annotationConfigs
      }));
      return this.executePutWithProgressDialog(requests, annotationOptions);
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
