import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl } from '@angular/forms';

import { Observable, pipe, throwError, EMPTY } from 'rxjs';
import { catchError, first } from 'rxjs/operators';
import { UnaryFunction } from 'rxjs/src/internal/types';

import { MessageDialog } from './message-dialog.service';
import { UserError } from '../exceptions';
import { LoggingService } from '../services/logging.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ErrorLogMeta, ErrorResponse } from '../schemas/common';
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

  getErrorResponse(error: any): ErrorResponse | undefined {
    if (error instanceof HttpErrorResponse) {
      const httpErrorResponse = error as HttpErrorResponse;
      if (typeof httpErrorResponse.error === 'string') {
        try {
          return JSON.parse(httpErrorResponse.error);
        } catch (e) {
          // Not an error response object
        }
      } else if (typeof httpErrorResponse.error === 'object') {
        return httpErrorResponse.error;
      }
    }
    return null;
  }

  createUserError(error: any): UserError {
    let title = 'We\'re sorry!';
    let message = 'Looks like something went wrong! ' +
      'We track these errors, but if the problem persists, ' +
      'feel free to contact us with the transaction id.';
    let additionalMsgs = [];
    let stacktrace = null;
    // A transaction id for log audits with Sentry (Sentry.io)
    let transactionId = this.createTransactionId();

    if (error instanceof HttpErrorResponse) {
      const httpErrorResponse = error as HttpErrorResponse;
      const errorResponse: ErrorResponse | undefined = this.getErrorResponse(error);

      // Detect if we got an error response object
      if (errorResponse && errorResponse.message) {
        title = errorResponse.title;
        message = errorResponse.message;
        additionalMsgs = errorResponse.additionalMsgs;
        stacktrace = errorResponse.stacktrace;
        transactionId = errorResponse.transactionId;
      }

      // Override some fields for some error codes
      if (httpErrorResponse.status === 403 || httpErrorResponse.status === 404) {
        message = 'The page that you are looking for does not exist. You may have ' +
          'followed a broken link or the page may have been removed.';
      } else if (httpErrorResponse.status === 413) {
        message = 'The server could not process your upload because it was too large.';
      }
    } else if (error instanceof UserError) {
      const userError = error as UserError;

      title = userError.title;
      message = userError.message;
      additionalMsgs = userError.additionalMsgs;
      stacktrace = userError.stacktrace;
      transactionId = userError.transactionId;

      if (error.cause != null) {
        const causeUserError = this.createUserError(error.cause);
        if (causeUserError.stacktrace != null) {
          if (stacktrace != null) {
            stacktrace = stacktrace + '\n\n------------------------------\n\n' + causeUserError.stacktrace;
          } else {
            stacktrace = causeUserError.stacktrace;
          }
        }
      }
    } else if (error instanceof Error) {
      const errorObject = error as Error;
      stacktrace = errorObject.message;

      if (errorObject.stack) {
        stacktrace += '\n\n' + errorObject.stack;
      }
    } else {
      stacktrace = error + '';
    }

    return new UserError(
      title, message, additionalMsgs, stacktrace, error, transactionId);
  }

  logError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    const {title, message, additionalMsgs, stacktrace, transactionId} = this.createUserError(error);

    this.loggingService.sendLogs(
      {title, message, additionalMsgs, stacktrace, transactionId, ...logInfo}
    ).pipe(
      first(),
      catchError(() => EMPTY)
    ).subscribe();
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    this.logError(error, logInfo);

    const {title, message, additionalMsgs, stacktrace, transactionId} = this.createUserError(error);

    this.messageDialog.display({
      title,
      message,
      additionalMsgs,
      stacktrace,
      transactionId,
      type: MessageType.Error,
    });
  }

  createCallback<T>(logInfo?: ErrorLogMeta): (e: any) => void {
    return error => {
      if (isNullOrUndefined(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
    };
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

  createFormErrorHandler<T>(form: AbstractControl,
                            apiFieldToFormFieldMapping = {}): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      const errorResponse: ErrorResponse | undefined = this.getErrorResponse(error);
      if (errorResponse && errorResponse.fields) {
        const remainingErrors: string[] = [];

        for (const apiFieldKey of Object.keys(errorResponse.fields)) {
          const formFieldKey = apiFieldToFormFieldMapping[apiFieldKey] || apiFieldKey;
          const field = form.get(formFieldKey);
          if (field != null) {
            field.setErrors({
              serverValidated: errorResponse.fields[apiFieldKey],
            });
          } else {
            for (const errorMessage of errorResponse.fields[apiFieldKey]) {
              remainingErrors.push(errorMessage);
            }
          }
        }

        if (remainingErrors.length) {
          form.setErrors({
            serverValidated: remainingErrors,
          });
        }
      }

      return throwError(error);
    }));
  }
}
