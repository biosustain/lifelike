import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { Progress } from 'app/interfaces/common-dialog.interface';

import { ErrorHandler } from './error-handler.service';
import { ProgressDialog } from './progress-dialog.service';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  constructor(
    private errorHandler: ErrorHandler,
    public readonly progressDialog: ProgressDialog,
  ) {}

  requestDownload(
    filename: string,
    project: () => Observable<any>,
    mimeType: string,
    extension: string
  ) {
    const progressDialogRef = this.progressDialog.display({
      title: `Export`,
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Generating the requested export...',
      })),
    });

    project().pipe(
        tap(
            () => progressDialogRef.close(),
            () => progressDialogRef.close()),
        this.errorHandler.create(),
    ).subscribe(resp => {
      // It is necessary to create a new blob object with mime-type explicitly set
      // otherwise only Chrome works like it should
      const newBlob = new Blob([resp], {
        type: mimeType,
      });

      // IE doesn't allow using a blob object directly as link href
      // instead it is necessary to use msSaveOrOpenBlob
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(newBlob);
        return;
      }

      // For other browsers:
      // Create a link pointing to the ObjectURL containing the blob.
      const data = window.URL.createObjectURL(newBlob);

      const link = document.createElement('a');
      link.href = data;
      link.download = filename + extension;
      // this is necessary as link.click() does not work on the latest firefox
      link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));

      setTimeout(() => {
        // For Firefox it is necessary to delay revoking the ObjectURL
        window.URL.revokeObjectURL(data);
        link.remove();
      }, 100);
    });
  }
}
