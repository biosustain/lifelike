import { Observable, pipe, throwError } from 'rxjs';
import { catchError, first } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageDialog } from './message-dialog.service';
import { Injectable } from '@angular/core';
import { UnaryFunction } from 'rxjs/src/internal/types';
import { UserError } from '../exceptions';
import { LoggingService } from '../services/logging.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ErrorLogMeta, ServerError } from 'app/interfaces/error.interface';
import { isNullOrUndefined } from 'util';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ErrorHandler {
  constructor(
    private readonly messageDialog: MessageDialog,
    private readonly loggingService: LoggingService,
  ) {}

  createTransactionId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  createUserError(error: any): UserError {
    let title = 'Problem Encountered';
    let message = 'The server encountered a problem. No further details are currently available.';
    let detail = null;
    // A transaction id for log audits with Sentry (Sentry.io)
    let transactionId = this.createTransactionId();

    if (error instanceof HttpErrorResponse) {
      const res = error as HttpErrorResponse;

      if (res.status === 404) {
        title = 'Not Found';
        message = 'The page that you are looking for does not exist. You may have followed a broken link ' +
          'or the page may have been removed.';
      } else if (res.status === 413) {
        title = 'Too Large';
        message = 'The server could not process your upload because it was too large.';
      } else if (res.status === 500) {
        title = 'Unexpected Application Problem';
        message = 'Lifelike has encountered some unexpected problems. Please try again later.';
      } else if (res.error && res.error.apiHttpError && res.error.apiHttpError.message != null) {
        message = (res.error as ServerError).apiHttpError.message;
      }

      if (res.error && res.error.detail) {
        detail = res.error.detail;
      }
      // Override auto generated transaction Id if HTTP request
      // as one is already provided by the interceptor
      if (res.error && res.error.transactionId) {
        transactionId = res.error.transactionId;
      }
    } else if (error instanceof UserError) {
      const userError = error as UserError;

      title = userError.title;
      message = userError.message;
      detail = userError.detail;
      transactionId = userError.transactionId;

      if (error.cause != null) {
        const causeUserError = this.createUserError(error.cause);
        if (causeUserError.detail != null) {
          if (detail != null) {
            detail = detail + '\n\n------------------------------\n\n' + causeUserError.detail;
          } else {
            detail = causeUserError.detail;
          }
        }
      }
    } else if (error instanceof Error) {
      const errorObject = error as Error;
      detail = errorObject.message;

      if (errorObject.stack) {
        detail += '\n\n' + errorObject.stack;
      }
    } else {
      detail = error + '';
    }

    return new UserError(title, message, detail, error, transactionId);
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    const {title, message, detail, transactionId} = this.createUserError(error);

    this.loggingService.sendLogs(
      {title, message, detail, transactionId, ...logInfo}
    ).pipe(
      first(),
      catchError(() => throwError('logging failure'))
    ).subscribe();

    this.messageDialog.display({
      title,
      message,
      detail,
      transactionId,
      type: MessageType.Error,
    });
  }

  create<T>(logInfo?: ErrorLogMeta): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      if (isNullOrUndefined(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
      return throwError(error);
    }));
  }
}
