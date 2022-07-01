import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize, map, tap, first } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { openDownloadForBlob } from 'app/shared/utils/files';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';
import { getObjectLabel } from '../utils/objects';
import { FileService } from '../services/file.service';

@Component({
  selector: 'app-object-viewer',
  templateUrl: 'object-viewer.component.html',
})
export class ObjectViewerComponent {
  object$ = this.file.object$;

  constructor(
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    private file: FileService
  ) {
  }

  downloadObject(target: FilesystemObject) {
    const progressDialogRef = this.progressDialog.display({
      title: `Download ${getObjectLabel(target)}`,
      progressObservables: [new BehaviorSubject<Progress>(new Progress({
        status: 'Generating download...',
      }))],
    });
    return this.file.content$.pipe(
      map(blob => {
        return new File([blob], target.filename);
      }),
      tap(file => {
        openDownloadForBlob(file, file.name);
      }),
      finalize(() => progressDialogRef.close()),
      this.errorHandler.create({label: 'Download file'}),
      first()
    ).toPromise();
  }

}
