import { HttpErrorResponse, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  defer,
  from,
  iif,
  Observable,
  of,
  throwError,
  Subject,
  concat,
  ConnectableObservable, EMPTY,
} from 'rxjs';
import {
  bufferWhen,
  catchError,
  filter,
  map,
  mergeMap,
  reduce,
  concatMap,
  tap,
  switchMap,
  startWith,
  endWith,
  publish,
  refCount,
  scan,
  shareReplay,
  finalize,
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
  fromPairs, mapValues, startsWith, omit,
} from 'lodash-es';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import {
  ErrorResponse,
  ResultMapping,
  SingleResult,
  WarningResponse,
} from 'app/shared/schemas/common';
import {
  Progress,
  ProgressArguments,
  ProgressMode
} from 'app/interfaces/common-dialog.interface';
import { isNotEmpty } from 'app/shared/utils';
import { idle } from 'app/shared/rxjs/idle-observable';
import { objectToMixedFormData } from 'app/shared/utils/forms';
import GraphNS from 'app/shared/providers/graph-type/interfaces';

import {
  ObjectCreateRequest,
  PDFAnnotationGenerationRequest,
  AnnotationGenerationResultData,
  FilesystemObjectData, HttpObservableResponse,
} from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';
import { ObjectUploadDialogComponent } from '../components/dialog/object-upload-dialog.component';
import File = GraphNS.File;

interface CreationResult {
  result?: FilesystemObject;
  warnings?: WarningResponse[];
  errors?: ErrorResponse[];
}

type AnnotationResult = AnnotationGenerationResultData & {
  error: ErrorResponse;
  missing: boolean
};

interface CreationAnnotationResult {
  creation: CreationResult | null;
  annotation: AnnotationResult | null;
}

interface Task<Result> {
  body$: Observable<Result>;
  progress$: Observable<ProgressArguments>;
}

interface PutTask {
  request: ObjectCreateRequest;
  creation: Task<SingleResult<FilesystemObject>>;
  annotation: Task<ResultMapping<AnnotationGenerationResultData> | { error: ErrorResponse }> & {
    options: PDFAnnotationGenerationRequest,
    call$: Subject<HttpObservableResponse<ResultMapping<AnnotationGenerationResultData>>>
  };
}

interface CreateToAnnotateStep {
  annotationTask?: HttpObservableResponse<ResultMapping<AnnotationGenerationResultData>>;
  creationTaskBatch: {
    request: PutTask['request'],
    creation: SingleResult<FilesystemObject>,
    annotation: PutTask['annotation']
  }[];
}

interface AnnotationResultStep extends CreateToAnnotateStep {
  annotationResult: ResultMapping<AnnotationGenerationResultData> | { error: ErrorResponse };
}

export type CreateResultMapping = Map<ObjectCreateRequest, CreationAnnotationResult>;

@Injectable()
export class ObjectCreationService {

  private readonly MAX_PARALLEL_CREATIONS = 3;
  private readonly MAX_PARALLEL_ANNOTATIONS = 1;

  constructor(protected readonly annotationsService: AnnotationsService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly route: ActivatedRoute,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService) {
  }


  private composeCreationTask(request: ObjectCreateRequest): Task<SingleResult<FilesystemObject>> {
    const {progress$, body$} = this.filesystemService.create(request);
    return {
      body$,
      progress$: progress$.pipe(
        map(event => {
          switch (event.type) {
            /**
             * The request was sent out over the wire.
             */
            case HttpEventType.Sent:
              return {
                mode: ProgressMode.Determinate,
                status: `Sending upload headers for ${request.filename || 'file'}...`,
              };
            /**
             * An upload progress event was received.
             */
            case HttpEventType.UploadProgress:
              return {
                mode: ProgressMode.Determinate,
                status: `Transmitting ${request.filename || 'file'}...`,
                value: event.loaded / event.total,
              };
            /**
             * The response status code and headers were received.
             */
            case HttpEventType.ResponseHeader:
              return {
                mode: ProgressMode.Indeterminate,
                status: `${request.filename || 'File'} transmitted; saving...`,
              };
            /**
             * A download progress event was received.
             */
            case HttpEventType.DownloadProgress:
              return {
                mode: ProgressMode.Determinate,
                status: `Downloading server response for ${request.filename || 'file'}...`,
                value: event.loaded / event.total,
              };
            /**
             * The full response including the body was received.
             */
            case HttpEventType.Response:
              return {
                mode: ProgressMode.Determinate,
                status: `Done uploading ${request.filename || 'file'}...`,
                value: 1,
                warnings: event.body?.warnings,
              };
            /**
             * A custom event from an interceptor or a backend.
             */
            case HttpEventType.User:
            default:
          }
        }),
        startWith({
          mode: ProgressMode.Indeterminate,
          status: `Preparing ${request.filename || 'file'}`,
        }),
        catchError(error =>
          of({
            mode: ProgressMode.Determinate,
            status: `Error occurred during upload/parsing of ${request.filename || 'file'}!`,
            value: 0,
            errors: [error],
          }),
        ),
        endWith({
          mode: ProgressMode.Determinate,
          status: `Done with ${request.filename || 'file'}...`,
          value: 1,
        }),
        shareReplay({bufferSize: 1, refCount: true}),
      ),
    } as Task<SingleResult<FilesystemObject>>;
  }

  private composeAnnotationTask(
    request,
    annotationCall$: Observable<null | HttpObservableResponse<ResultMapping<AnnotationGenerationResultData>>>,
  ): Task<ResultMapping<AnnotationGenerationResultData>> {
    return {
      body$: annotationCall$.pipe(
        switchMap(annotationCall =>
          annotationCall?.body$ ?? of(null)
        ),
      ),
      progress$: annotationCall$?.pipe(
        switchMap(annotationCall =>
          annotationCall?.progress$.pipe(
              map(event => {
                switch (event.type) {
                  /**
                   * The request was sent out over the wire.
                   */
                  case HttpEventType.Sent:
                    return {
                      mode: ProgressMode.Determinate,
                      status: `Sending upload headers for ${request.filename || 'file'}...`,
                    };
                  /**
                   * An upload progress event was received.
                   */
                  case HttpEventType.UploadProgress:
                    return {
                      mode: ProgressMode.Determinate,
                      status: `Transmitting ${request.filename || 'file'}...`,
                      value: event.loaded / event.total,
                    };
                  /**
                   * The response status code and headers were received.
                   */
                  case HttpEventType.ResponseHeader:
                    return {
                      mode: ProgressMode.Indeterminate,
                      status: `${request.filename || 'File'} transmitted; saving...`,
                    };
                  /**
                   * A download progress event was received.
                   */
                  case HttpEventType.DownloadProgress:
                    return {
                      mode: ProgressMode.Determinate,
                      status: `Downloading server response for ${request.filename || 'file'}...`,
                      value: event.loaded / event.total,
                    };
                  /**
                   * The full response including the body was received.
                   */
                  case HttpEventType.Response:
                    const result = event.body.mapping?.[request.hashId];
                    if (result.error) {
                      return {
                        mode: ProgressMode.Determinate,
                        status: `${request.filename || 'File'} saved; Error occured while parsing and identifying annotations...`,
                        value: 1,
                        errors: [
                          {
                            title: '',
                            message: result.error,
                          } as ErrorResponse,
                        ],
                      };
                    }
                    if (result.attempted) {
                      return {
                        mode: ProgressMode.Determinate,
                        status: `${request.filename || 'File'} saved; Attempted parsing and identifying annotations...`,
                        value: 1,
                      };
                    }
                    const missing = event.body.missing[request.hashId];
                    if (missing) {
                      return {
                        mode: ProgressMode.Determinate,
                        status: `${request.filename || 'File'} saved; Missing annotations...`,
                        value: 1,
                      };
                    }
                    if (result.success) {
                      return {
                        mode: ProgressMode.Determinate,
                        status: `Done uploading and annotating ${request.filename || 'file'}...`,
                        value: 1,
                      };
                    }
                  /**
                   * A custom event from an interceptor or a backend.
                   */
                  // tslint:disable-next-line:no-switch-case-fall-through
                  case HttpEventType.User:
                  default:
                    return {
                      mode: ProgressMode.Determinate,
                      status: `Unknown state of annotating ${request.filename || 'file'}...`,
                      value: 1,
                    };
                }
              }),
              startWith({
                mode: ProgressMode.Indeterminate,
                status: `${request.filename || 'File'} saved; Parsing and identifying annotations...`,
              }),
              catchError(error =>
                of({
                  mode: ProgressMode.Determinate,
                  status: `Error occurred during annotating of ${request.filename || 'file'}!`,
                  value: 0,
                  errors: [error],
                }),
              ),
              endWith({
                mode: ProgressMode.Determinate,
                status: `Done uploading and annotating ${request.filename || 'file'}...`,
                value: 1,
              }),
              shareReplay({bufferSize: 1, refCount: true}),
            ) ?? EMPTY
        ),
      ),
    };
  }

  private parseAnnotationStatus(
    annotationResult: ResultMapping<AnnotationGenerationResultData> | { error: ErrorResponse },
    hashId: string,
  ): (AnnotationGenerationResultData | {}) & { missing: boolean, error: ErrorResponse } {
    return assign(
      (annotationResult as ResultMapping<AnnotationGenerationResultData>)?.mapping?.[hashId] ?? {},
      {
        missing: (annotationResult as ResultMapping<AnnotationGenerationResultData>)?.missing?.includes(hashId) ?? false,
      },
      omit(annotationResult, 'mapping', 'missing') as { error: ErrorResponse },
    );
  }


  /**
   * Handles the filesystem PUT request(s) with a progress dialog.
   * @param requests the request(s) data
   * @param annotationOptions options for the annotation process(es)
   * @return the created object(s)
   */
  executePutWithProgressDialog(
    requests: ObjectCreateRequest[],
    annotationOptions: PDFAnnotationGenerationRequest[],
  ): Observable<CreateResultMapping> {
    const putTasks: PutTask[] = zip(requests, annotationOptions).map(([request, options]) => {
      const annotationCall$ = new Subject<HttpObservableResponse<ResultMapping<AnnotationGenerationResultData>>>();
      return ({
        request,
        creation: this.composeCreationTask(request),
        annotation: {
          ...this.composeAnnotationTask(request, annotationCall$),
          options,
          call$: annotationCall$,
        },
      });
    });
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${requests.length > 1 ? 'Files' : requests[0].filename}'`,
      progressObservables: putTasks.map(({creation, annotation}) =>
        concat(creation.progress$, annotation.progress$).pipe(
          // Accumulate warnings and errors
          scan((prev, next) => ({
            ...next,
            warnings: [
              ...(prev.warnings ?? []),
              ...(next.warnings ?? []),
            ],
            errors: [
              ...(prev.errors ?? []),
              ...(next.errors ?? []),
            ],
          })),
          map(args => new Progress(args)),
        ),
      ),
    });
    return from(putTasks).pipe(
      mergeMap(
        ({request, creation, annotation}) => creation.body$.pipe(
          this.errorHandler.create({label: 'Create object'}),
          catchError(() => of(null as SingleResult<FilesystemObject> | null)),
          map(creationResult => ({
            request,
            creation: creationResult,
            annotation,
          })),
        ),
        this.MAX_PARALLEL_CREATIONS,
      ),
      // Batch annotation generation requests
      bufferWhen(() => idle()),
      concatMap(resultBatch => {
        const [resultsToAnnotate, resultsNotAnnotatable] = partition(
          resultBatch,
          ({creation: {result, warnings}}) =>
            result?.isAnnotatable &&
            !some(warnings, ({type}) => type === 'TextExtractionNotAllowedWarning'),
        );
        const uniqeAnnotationConfigs: PDFAnnotationGenerationRequest[] = unionBy(
          resultsToAnnotate.map(({annotation: {options}}) => options),
          isEqual,
        );
        // generateAnnotations can be called for multiple files but within one config
        const resultsToAnnotateGroupedByAnnotationConfig = groupBy(
          resultsToAnnotate,
          resultToAnnotate => uniqeAnnotationConfigs.findIndex(
            ac => isEqual(resultToAnnotate.annotation.options, ac),
          ),
        );
        return from(entries(resultsToAnnotateGroupedByAnnotationConfig)).pipe(
          map(([uniqeAnnotationConfigIndex, creationTaskBatch]) =>
            ({
              annotationTask: this.annotationsService.generateAnnotations(
                creationTaskBatch.map(task => task.creation.result.hashId),
                uniqeAnnotationConfigs[uniqeAnnotationConfigIndex],
              ),
              creationTaskBatch,
            } as CreateToAnnotateStep),
          ),
          startWith({
            annotationTask: null,
            creationTaskBatch: resultsNotAnnotatable,
          } as CreateToAnnotateStep),
          tap(({annotationTask, creationTaskBatch}) =>
            forEach(creationTaskBatch, ({annotation: {call$}}) => call$.next(annotationTask)),
          ),
        );
      }),
      mergeMap(({annotationTask, creationTaskBatch}) =>
          (annotationTask?.body$ ?? of(null)).pipe(
            this.errorHandler.create({label: 'Annotate objects'}),
            catchError((annotationError: ErrorResponse) =>
              of({error: annotationError}),
            ),
            map(annotationResult => ({
              annotationResult,
              creationTaskBatch,
            } as AnnotationResultStep)),
          ),
        this.MAX_PARALLEL_ANNOTATIONS,
      ),
      reduce(
        (acc, {annotationResult, creationTaskBatch}) => {
          forEach(creationTaskBatch, creationTask => {
            const hashId = creationTask.creation.result?.hashId;
            acc.set(creationTask.request, {
              ...creationTask,
              annotation: this.parseAnnotationStatus(annotationResult, hashId),
            } as CreationAnnotationResult);
          });
          return acc;
        },
        new Map<ObjectCreateRequest, CreationAnnotationResult>(),
      ),
      finalize(() => progressDialogRef.componentInstance?.close())
    );
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
      'request',
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = ((requests: ObjectCreateRequest[]) => {
      const annotationOptions: PDFAnnotationGenerationRequest[] = requests.map(request => ({
        organism: request?.fallbackOrganism,
        annotationConfigs: request?.annotationConfigs,
      }));
      return this.executePutWithProgressDialog(requests, annotationOptions).toPromise()
        .then(resultsMapping => resultsMapping.values().next().value.creation.result);
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
