import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpHandler,
    HttpRequest,
    HttpErrorResponse,
  } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * LogInterceptor is used to create a unique transaction
 * id that can be added to the Sentry SDK to track
 * a transaction's lifecycle.
 */
@Injectable()
export class LogInterceptor implements HttpInterceptor {
    constructor() {}

    intercept(req: HttpRequest<any>, next: HttpHandler) {
        return next.handle(this.addLogHeader(req)).pipe(
            catchError((res: HttpErrorResponse) => throwError(res))
        );
    }

    addLogHeader(request: HttpRequest<any>) {
        const transactionId = Math.random().toString(36).substr(2, 9);
        return request.clone({setHeaders: {'X-Transaction-ID': transactionId}});
    }
}
