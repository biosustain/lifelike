import { Component, OnDestroy } from '@angular/core';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { FilesystemService } from '../services/filesystem.service';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { FilesystemObject } from '../models/filesystem-object';
import { getObjectLabel } from '../utils/objects';
import { Progress } from '../../interfaces/common-dialog.interface';
import { finalize, map, tap } from 'rxjs/operators';
import { openDownloadForBlob } from '../../shared/utils/files';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';

@Component({
  selector: 'app-object-viewer',
  templateUrl: 'object-viewer.component.html',
})
export class ObjectViewerComponent implements OnDestroy {

  protected readonly subscriptions = new Subscription();
  object$: Observable<FilesystemObject>;

  constructor(protected readonly route: ActivatedRoute,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog) {
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.object$ = this.filesystemService.get(params.hash_id);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  downloadObject(target: FilesystemObject) {
    const progressDialogRef = this.progressDialog.display({
      title: `Download ${getObjectLabel(target)}`,
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Generating download...',
      })),
    });
    this.filesystemService.getContent(target.hashId).pipe(
      map(blob => {
        return new File([blob], target.filename);
      }),
      tap(file => {
        openDownloadForBlob(file, file.name);
      }),
      finalize(() => progressDialogRef.close()),
      this.errorHandler.create({label: 'Download file'}),
    ).subscribe();
  }

}
