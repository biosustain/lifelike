import { Observable, pipe, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageDialog } from './message-dialog.service';
import { Injectable } from '@angular/core';
import { UnaryFunction } from 'rxjs/src/internal/types';
import { UserError } from '../exceptions';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ErrorHandler {
  constructor(private readonly messageDialog: MessageDialog) {
  }

  create<T>(): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      let title = 'Problem Encountered';
      let message = 'The server encountered a problem. No further details are currently available.';
      let detail = null;

      if (error instanceof HttpErrorResponse) {
        const res = error as HttpErrorResponse;

        if (res.status === 404) {
          title = 'Not Found';
          message = 'The document that you are looking for does not exist. You may have followed a broken link ' +
            'or the document may have been removed.';
        } else if (res.error && res.error.message) {
          message = res.error.message;
        }

        if (res.error && res.error.detail) {
          detail = res.error.detail;
        }
      } else if (error instanceof UserError) {
        const userError = error as UserError;

        title = userError.title;
        message = userError.message;
      }

      this.messageDialog.display({
        title,
        message,
        detail,
        type: MessageType.Error,
      });

      return throwError(error);
    }));
  }
}
