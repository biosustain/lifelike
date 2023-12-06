import { HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { from, Observable, of } from 'rxjs';
import {
  catchError,
  endWith,
  finalize,
  map,
  mergeMap,
  reduce,
  scan,
  shareReplay,
  startWith,
} from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { SingleResult } from 'app/shared/schemas/common';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

import { CreationResult, ObjectCreateRequest, Task } from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { ObjectPublishDialogComponent } from '../components/dialog/object-publish-dialog.component';

interface PublishTask {
  request: ObjectCreateRequest;
  publishTask: Task<SingleResult<FilesystemObject>>;
}

export type PublishResultMapping = Map<ObjectCreateRequest, CreationResult>;

@Injectable()
export class PublishService {
  private readonly MAX_PARALLEL_PUBLICATIONS = 3;

  constructor(
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly progressDialog: ProgressDialog,
    protected readonly route: ActivatedRoute,
    protected readonly messageDialog: MessageDialog,
    protected readonly errorHandler: ErrorHandler,
    protected readonly filesystemService: FilesystemService
  ) {}

  private composePublishTask(
    request: ObjectCreateRequest,
    userHashId: string
  ): Task<SingleResult<FilesystemObject>> {
    const { progress$, body$ } = this.filesystemService.publish(request, userHashId);
    return {
      body$,
      progress$: progress$.pipe(
        map((event) => {
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
                info: event.body?.info,
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
        catchError((error) =>
          of({
            mode: ProgressMode.Determinate,
            status: `Error occurred during upload/parsing of ${request.filename || 'file'}!`,
            value: 0,
            errors: [error],
          })
        ),
        endWith({
          mode: ProgressMode.Determinate,
          status: `Done with ${request.filename || 'file'}...`,
          value: 1,
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      ),
    } as Task<SingleResult<FilesystemObject>>;
  }

  /**
   * Handles the filesystem PUT request(s) with a progress dialog.
   * @param requests the request(s) data
   * @return the created object(s)
   */
  executePutWithProgressDialog(
    requests: ObjectCreateRequest[],
    userHashId: string
  ): Observable<PublishResultMapping> {
    const putTasks: PublishTask[] = requests.map((request) => ({
      request,
      publishTask: this.composePublishTask(request, userHashId),
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Publishing '${requests.length > 1 ? 'Files' : requests[0].filename}'`,
      progressObservables: putTasks.map(({ publishTask }) =>
        publishTask.progress$.pipe(
          // Accumulate warnings and errors
          scan((prev, next) => ({
            ...next,
            info: [...(prev.info ?? []), ...(next.info ?? [])],
            warnings: [...(prev.warnings ?? []), ...(next.warnings ?? [])],
            errors: [...(prev.errors ?? []), ...(next.errors ?? [])],
          })),
          map((args) => new Progress(args))
        )
      ),
    });
    return from(putTasks).pipe(
      mergeMap(
        ({ request, publishTask }) =>
          publishTask.body$.pipe(
            this.errorHandler.create({ label: 'Publish object' }),
            catchError(() => of(null as SingleResult<FilesystemObject> | null)),
            map((creation) => ({
              request,
              creation,
            }))
          ),
        this.MAX_PARALLEL_PUBLICATIONS
      ),
      reduce((acc, publishTask) => {
        acc.set(publishTask.request, publishTask.creation);
        return acc;
      }, new Map<ObjectCreateRequest, CreationResult>()),
      finalize(() => progressDialogRef.componentInstance?.close())
    );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openPublishDialog(
    target: FilesystemObject,
    options: PublishDialogOptions = {},
    userHashId: string
  ): Promise<FilesystemObject> {
    const dialogRef = this.modalService.open(ObjectPublishDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New File';
    dialogRef.componentInstance.object = target;
    const keys: Array<keyof PublishDialogOptions> = [
      'promptUpload',
      'promptParent',
      'parentLabel',
      'request',
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = (requests: ObjectCreateRequest[]) =>
      this.executePutWithProgressDialog(requests, userHashId).toPromise();
    return dialogRef.result;
  }
}

export interface PublishDialogOptions {
  title?: string;
  promptUpload?: boolean;
  promptParent?: boolean;
  parentLabel?: string;
  request?: Partial<ObjectCreateRequest>;
}
