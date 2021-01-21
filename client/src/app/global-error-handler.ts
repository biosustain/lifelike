import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';
import { ErrorHandler as ErrorHandlerService } from 'app/shared/services/error-handler.service';

@Injectable()
/**
 * GlobalErrorHandler will handle ALL uncaught errors/exceptions. This includes
 * errors that only occur client side.
 */
export class GlobalErrorHandler implements ErrorHandler {
    constructor(private errorHandlerService: ErrorHandlerService) {}

    handleError(error: Error | HttpErrorResponse) {
        this.errorHandlerService.showError(error, {label: 'Uncaught exception', expected: false});
    }
}
