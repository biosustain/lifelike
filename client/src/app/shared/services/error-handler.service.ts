import { Observable, pipe, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageDialog } from './message-dialog.service';
import { Injectable } from '@angular/core';
import { UnaryFunction } from 'rxjs/src/internal/types';
import { UserError } from '../exceptions';

import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ErrorResponse } from '../schemas/common';
import { AbstractControl } from '@angular/forms';


@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ErrorHandler {
  constructor(private readonly messageDialog: MessageDialog) {
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
    let title = 'Problem Encountered';
    let message = 'The server encountered a problem. No further details are currently available.';
    let detail = null;
    // A transaction id for log audits with Sentry (Sentry.io)
    let transactionId = null;

    if (error instanceof HttpErrorResponse) {
      const httpErrorResponse = error as HttpErrorResponse;
      const errorResponse: ErrorResponse | undefined = this.getErrorResponse(error);

      // Detect if we got an error response object
      if (errorResponse && errorResponse.message) {
        message = errorResponse.message;
        detail = errorResponse.detail;
        transactionId = errorResponse.transactionId;
      }

      // Override some fields for some error codes
      if (httpErrorResponse.status === 404) {
        title = 'Not Found';
        message = 'The page that you are looking for does not exist. You may have' +
          'followed a broken link or the page may have been removed.';
      } else if (httpErrorResponse.status === 413) {
        title = 'Too Large';
        message = 'The server could not process your upload because it was too large.';
      } else if (httpErrorResponse.status === 400) {
        title = 'Invalid Input';
      } else if (httpErrorResponse.status === 403) {
        title = 'Insufficient Permission';
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

  showError(error) {
    const {title, message, detail, transactionId} = this.createUserError(error);

    this.messageDialog.display({
      title,
      message,
      detail,
      transactionId,
      type: MessageType.Error,
    });
  }

  create<T>(): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      this.showError(error);

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
