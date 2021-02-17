import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';
import { ErrorHandler as ErrorHandlerService } from 'app/shared/services/error-handler.service';

@Injectable()
/**
 * GlobalErrorHandler will handle ALL uncaught errors/exceptions. This includes
 * errors that only occur client side.
 */
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private errorHandlerService: ErrorHandlerService) {
  }

  // Used to prevent error dialogs for specific HTTP codes
  KNOWN_HTTP_ERROR_CODES = [0, 401];

  handleError(error: Error | HttpErrorResponse) {
    if (!(error instanceof HttpErrorResponse && this.KNOWN_HTTP_ERROR_CODES.includes(error.status))) {
      this.errorHandlerService.logError(error, {label: 'Uncaught exception', expected: false});

      // We are logging the error but are not changing how errors are handled
      throw error;
    }
  }
}
