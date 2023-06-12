import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl } from '@angular/forms';

import { isNil, compact, defaults } from 'lodash-es';
import { EMPTY, Observable, of, pipe, throwError, from } from 'rxjs';
import { catchError, first, map, mergeMap, switchMap } from 'rxjs/operators';
import { UnaryFunction } from 'rxjs/internal/types';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageDialog } from './message-dialog.service';
import { isOfflineError, UserError } from '../exceptions';
import { LoggingService } from '../services/logging.service';
import { ErrorLogMeta, ErrorResponse } from '../schemas/common';
import { mapBlobToBuffer, mapBufferToJson, bufferToJson } from '../utils/files';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ErrorHandler {
  constructor(
    private readonly messageDialog: MessageDialog,
    private readonly loggingService: LoggingService,
  ) {
  }

  httpCodeMessages = {
    404: 'The page that you are looking for does not exist. You may have ' +
      'followed a broken link or the page may have been removed.',
    413: 'The server could not process your upload because it was too large.',
  };

  createTransactionId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getErrorResponse(error: any): ErrorResponse | Promise<ErrorResponse> {
    if (error instanceof HttpErrorResponse) {
      const httpErrorResponse = error as HttpErrorResponse;
      if (typeof httpErrorResponse.error === 'string') {
        return JSON.parse(httpErrorResponse.error);
      } else if (httpErrorResponse.error instanceof Blob) {
        return httpErrorResponse.error.arrayBuffer()
          .then(buff => bufferToJson<ErrorResponse | undefined>(buff));
        // If JSON parsing fails, just go back to default behavior
      } else if (typeof httpErrorResponse.error === 'object') {
        return httpErrorResponse.error.message ? httpErrorResponse.error : httpErrorResponse;
      }
    }
  }

  createUserError(error: any, options: { transactionId?: string } = {}): UserError | Promise<UserError> {
    const defaultErrorResponse: ErrorResponse = {
      ...error,
      title: 'We\'re sorry!',
      message: 'Looks like something went wrong on our end! Please try again in a moment.',
      additionalMsgs: [],
      stacktrace: null,
      transactionId: options.transactionId != null ? options.transactionId : 'L-' + this.createTransactionId(),
    };
    if (error instanceof HttpErrorResponse) {
      return Promise.resolve(this.getErrorResponse(error))
        // errorResponse is only correct if it has message field
        .catch(() => ({}))
        .then((errorResponse: ErrorResponse) => new UserError({
          ...defaults(errorResponse.message ? errorResponse : {}, defaultErrorResponse),
          // Override some fields for some error codes
          message: this.httpCodeMessages[error.status] ?? errorResponse.message,
        }));
    } else if (error instanceof UserError) {
      if (error.cause != null) {
        return Promise.resolve(this.createUserError(error.cause)).then(({stacktrace}) => {
          return new UserError({
            ...defaultErrorResponse,
            stacktrace: compact([error.stacktrace, stacktrace]).join('\n\n------------------------------\n\n'),
          });
        });
      } else {
        return error;
      }
    } else if (error instanceof Error) {
      return new UserError({
        ...defaultErrorResponse,
        stacktrace: compact([error.message, error.stack]).join('\n\n'),
      });
    } else {
      return new UserError({
        ...defaultErrorResponse,
        stacktrace: error + '',
      });
    }
  }

  logError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    return Promise.resolve(this.createUserError(error))
      .then(({title, message, additionalMsgs, stacktrace, transactionId}) =>
        this.loggingService.sendLogs(
          {title, message, additionalMsgs, stacktrace, transactionId, ...logInfo},
        ).pipe(
          catchError(() => {
            console.warn('Error could not be logged due to connection issue', error);
            return EMPTY;
          }),
        ).toPromise(),
      );
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta): Promise<any> {
    if (isOfflineError(error)) {
      // offline error is handled in interceptor
      return Promise.reject();
    }
    return Promise.allSettled([
      this.logError(error, logInfo),
      Promise.resolve(this.createUserError(error))
        .then(userError =>
          this.messageDialog.display({
            ...userError,
            type: MessageType.Error,
          }),
        ),
    ]);
  }

  createCallback<T>(logInfo?: ErrorLogMeta): (e: any) => void {
    return error => {
      if (isNil(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
    };
  }

  create<T>(logInfo?: ErrorLogMeta): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      if (isNil(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
      return throwError(error);
    }));
  }

  createFormErrorHandler<T>(form: AbstractControl,
                            apiFieldToFormFieldMapping = {}): UnaryFunction<Observable<T>, Observable<T>> {
    return catchError(error =>
      from(Promise.resolve(this.getErrorResponse(error)))
        .pipe(
          catchError(() => of(error)),
          switchMap(errorResponse => {
            if (errorResponse?.fields) {
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
          }),
        )
    );
  }
}
