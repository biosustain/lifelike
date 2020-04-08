import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
    baseUrl = environment.apiUrl;

    constructor() {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
        return next.handle(req).pipe(
            catchError((res: HttpErrorResponse) => {
                const statusCode = res.status;
                if (statusCode === 0) {
                    return throwError('No internet connection');
                    // TODO: Handle the following errors below
                } else if (statusCode >= 400 && statusCode < 500) {
                    return throwError(res);
                } else if (statusCode >= 500) {
                    return throwError(res);
                } else {
                    return throwError(res);
                }
            }),
        );
    }
}
