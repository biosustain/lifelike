import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
    constructor() {}

    intercept(req: HttpRequest<any>, next: HttpHandler) {
        return next.handle(req).pipe(
            catchError((res: HttpErrorResponse) => {
                if (res.status === 0) {
                    // TODO: client-side error
                    // e.g no network
                    return throwError('No internet connection');
                } else {
                    return throwError({
                        serverError: res.error.apiHttpError,
                        status: res.status,
                    });
                }
            }),
        );
    }
}
