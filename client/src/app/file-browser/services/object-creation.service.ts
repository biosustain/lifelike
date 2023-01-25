import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { defer, from, iif, Observable, of, throwError } from 'rxjs';
import {
  bufferWhen,
  catchError,
  filter,
  map,
  mergeMap,
  reduce,
  switchMap,
  tap,
} from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  assign,
  entries,
  find,
  forEach,
  groupBy,
  isEqual,
  partition,
  some,
  unionBy,
  zip,
  fromPairs, mapValues,
} from 'lodash-es';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ResultMapping, SingleResult } from 'app/shared/schemas/common';
import { ProgressMode, ProgressSubject } from 'app/interfaces/common-dialog.interface';
import { isNotEmpty } from 'app/shared/utils';
import { idle } from 'app/shared/rxjs/idle-observable';

import { ObjectCreateRequest, PDFAnnotationGenerationRequest, AnnotationGenerationResultData } from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';
import { ObjectUploadDialogComponent } from '../components/dialog/object-upload-dialog.component';

class CreationProgressSubject extends ProgressSubject {
  constructor(private filename: string) {
    super({ status: `Preparing ${filename || 'file'}` });
  }

  send() {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Sending upload headers for ${this.filename || 'file'}...`,
    });
  }

  uploadProgress(value: number) {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Transmitting ${this.filename || 'file'}...`,
      value,
    });
  }

  responseHeader() {
    this.next({
      mode: ProgressMode.Indeterminate,
      status: `${this.filename || 'File'} transmitted; saving...`,
    });
  }

  downloadProgress(value: number) {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Downloading server response for ${this.filename || 'file'}...`,
      value,
    });
  }

  doneUploading() {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Done uploading ${this.filename || 'file'}...`,
      value: 1,
    });
  }

  errorUploading(error) {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Error occurred during upload/parsing of ${this.filename || 'file'}!`,
      value: 0,
    });
    this.error(error);
  }

  annotating() {
    this.next({
      mode: ProgressMode.Indeterminate,
      status: `${this.filename || 'File'} saved; Parsing and identifying annotations...`,
    });
  }

  done() {
    this.next({
      mode: ProgressMode.Determinate,
      status: `Done with ${this.filename || 'file'}...`,
      value: 1,
    });
  }

  errorAnnotating(error) {
    this.next({
      mode: ProgressMode.Determinate,
      status: `${this.filename || 'File'} saved; Error occured while parsing and identifying annotations...`,
      value: 1,
    });
    this.error(error);
  }

  atteptedAnnotating() {
    this.next({
      mode: ProgressMode.Determinate,
      status: `${this.filename || 'File'} saved; Attempted parsing and identifying annotations...`,
      value: 1,
    });
  }
}

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
   * Handles the filesystem PUT request(s) with a progress dialog.
   * @param requests the request(s) data
   * @param annotationOptions options for the annotation process(es)
   * @return the created object(s)
   */
  executePutWithProgressDialog(
    requests: ObjectCreateRequest[],
    annotationOptions: PDFAnnotationGenerationRequest[]
  ): Observable<Map<ObjectCreateRequest, FilesystemObject|Error>> {
    const requestList = zip(requests, annotationOptions).map(([request, ao]) => {
      const progressObservable = new CreationProgressSubject(request.filename);
      return ({
        request,
        annotationOption: ao,
        progressObservable
      });
    });
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${requests.length > 1 ? 'Files' : requests[0].filename}'`,
      progressObservables: requestList.map(r => r.progressObservable),
    });
    return from(requestList).pipe(
      mergeMap(
        creation =>
          this.filesystemService.create(creation.request)
            .pipe(
              tap(event => {
                switch (event.type) {
                  /**
                   * The request was sent out over the wire.
                   */
                  case HttpEventType.Sent:
                    creation.progressObservable.send();
                    break;
                  /**
                   * An upload progress event was received.
                   */
                  case HttpEventType.UploadProgress:
                    creation.progressObservable.uploadProgress(event.loaded / event.total);
                    break;
                  /**
                   * The response status code and headers were received.
                   */
                  case HttpEventType.ResponseHeader:
                    creation.progressObservable.responseHeader();
                    break;
                  /**
                   * A download progress event was received.
                   */
                  case HttpEventType.DownloadProgress:
                    creation.progressObservable.downloadProgress(event.loaded / event.total);
                    break;
                  /**
                   * The full response including the body was received.
                   */
                  case HttpEventType.Response:
                    creation.progressObservable.doneUploading();
                    break;
                  /**
                   * A custom event from an interceptor or a backend.
                   */
                  case HttpEventType.User:
                  default:
                }
              }),
              filter(({type}) => type === HttpEventType.Response),
              this.errorHandler.create({label: 'Create object'}),
              catchError(error => {
                creation.progressObservable.errorUploading(error);
                // Pass error through as value (inspired by Promise.allSettled)
                return of({
                  ...creation,
                  status: 'rejected',
                  reason: error,
                });
              }),
              map(({body: {warnings, result}}: HttpResponse<SingleResult<FilesystemObject>>) => {
                forEach(
                  warnings,
                  warning => creation.progressObservable.warning(warning),
                );
                // Pass through as value (inspired by Promise.allSettled)
                return {
                  ...creation,
                  status: 'fulfilled',
                  value: result,
                  warnings,
                };
              }),
            ),
        3,
      ),
      // Batch annotation generation requests
      bufferWhen(() => idle()),
      switchMap(resultBatch => {
        const [resultsToAnnotate, resultsNotAnnotatable] = partition(
          resultBatch,
          ({
             status,
             value,
             warnings,
           }) =>
            status === 'fulfilled' &&
            (value as FilesystemObject).isAnnotatable &&
            !some(warnings, ({type}) => type === 'TextExtractionNotAllowed'),
        );
        forEach(resultsNotAnnotatable, result => {
          result.progressObservable.done();
        });
        const uniqeAnnotationConfigs = unionBy(
          resultsToAnnotate.map(({annotationOption}) => annotationOption),
          isEqual,
        );
        // generateAnnotations can be called for multiple files but within one config
        const resultsToAnnotateGroupedByAnnotationConfig = groupBy(
          resultsToAnnotate,
          resultToAnnotate => uniqeAnnotationConfigs.findIndex(
            ac => isEqual(resultToAnnotate.annotationOption, ac),
          ),
        );
        return iif(
          () => isNotEmpty(resultsToAnnotateGroupedByAnnotationConfig),
          from(entries(resultsToAnnotateGroupedByAnnotationConfig)).pipe(
            mergeMap(
              ([annotationOptionIndex, results]) => {
                const hashIds = results.map(resultToAnnotate => {
                  // Then we show progress for the annotation generation (although
                  // we can't actually show a progress percentage)
                  resultToAnnotate.progressObservable.annotating();
                  return (resultToAnnotate.value as FilesystemObject).hashId;
                });

                return this.annotationsService.generateAnnotations(
                  hashIds, uniqeAnnotationConfigs[annotationOptionIndex] || {},
                ).pipe(
                  catchError(error =>
                    of({
                      mapping: fromPairs(
                        hashIds.map(hashId =>
                          [hashId, {error: error?.error} as AnnotationGenerationResultData]
                        )
                      ),
                      missing: []
                    })
                  ),
                  tap(({mapping}) => {
                    forEach(entries(mapping), ([hashId, annotationResult]) => {
                      const resultToAnnotate = find(results, r => r.value.hashId === hashId);
                      if (annotationResult.success) {
                        resultToAnnotate.progressObservable.done();
                      } else {
                        if (annotationResult.error) {
                          resultToAnnotate.progressObservable.errorAnnotating(annotationResult.error);
                        } else {
                          if (annotationResult.attempted) {
                            resultToAnnotate.progressObservable.atteptedAnnotating();
                          } else {
                            resultToAnnotate.progressObservable.done();
                          }
                        }
                      }
                    });
                  }),
                  map(({mapping, missing}) => ({
                    mapping: mapValues(
                      mapping,
                      m => ({
                        ...m,
                        error: (m.error as any)?.message ?? m.error
                      }),
                    ),
                    missing
                  }))
                );
              },
              3,
            ),
            map(annotationResults => ({annotationResults, resultBatch})),
          ),
          of({annotationResults: {}, resultBatch})
        );
      }),
      reduce(
        (acc, {annotationResults, resultBatch}) => ({
          annotationResults: acc.annotationResults.concat(annotationResults),
          results: acc.results.concat(resultBatch)
        }),
        {
          annotationResults: [],
          results: []
        }
      ),
      switchMap(({annotationResults, results}) =>
        iif(
          () => some(annotationResults, ({success}) => !success),
          defer(() => {
            const modalRef = this.modalService.open(ObjectReannotateResultsDialogComponent);
            modalRef.componentInstance.objects = results
              .filter(({status}) => status === 'fulfilled')
              .map(({value}) => value);
            modalRef.componentInstance.results = annotationResults;
            return modalRef.result;
          }).pipe(
            // Move on with file contents - regardles of reannotation step results
            map(() => results),
            // Suppres errors - its fine if user does cancel reannotation
            catchError(() => of(results)),
          ),
          of(results),
        ),
      ),
      tap(results => {
        if (!results.some(({warnings}) => isNotEmpty(warnings))) {
          progressDialogRef.componentInstance.close();
        }
      }),
      map(results =>
        results.reduce(
          (acc, {request, value, reason}) => {
            acc.set(request, value ?? reason);
            return acc;
          },
          new Map<ObjectCreateRequest, FilesystemObject | Error>(),
        ),
      ),
      catchError(error => {
        console.error(error);
        return throwError(error);
      })
    );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: CreateDialogOptions = {}): Promise<FilesystemObject[]> {
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
        organism: request?.fallbackOrganism,
        annotationConfigs: request?.annotationConfigs
      }));
      return this.executePutWithProgressDialog(requests, annotationOptions).toPromise();
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
