import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';

import { isNull } from 'lodash';
import { Store } from '@ngrx/store';
import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

import { State } from 'app/***ARANGO_USERNAME***-store/state';
import { SnackbarActions } from 'app/shared/store';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { createTransactionId } from 'app/shared/utils/identifiers';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(
    private store: Store<State>,
    private errorHandler: ErrorHandler) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(this.addLogHeader(req)).pipe(
      catchError((res: HttpErrorResponse) => {
        const statusCode = res.status;
        if (statusCode === 0) {
          this.store.dispatch(SnackbarActions.displaySnackbar({
            payload: {
              message: 'Your request couldn\'t go through due to a bad connection. ' +
                'Please check your Internet connection or try again later.',
              action: 'Dismiss',
              config: {
                verticalPosition: 'top',
                duration: 10000,
              },
            },
          }));
          return throwError(res);
        } else if (statusCode >= 400) {
          return throwError(res);
        }
        return throwError(res);
      }),
    );
  }

  addLogHeader(request: HttpRequest<any>) {
    // Don't reset the transaction id for the request if it was explicitly added.
    if (isNull(request.headers.get('X-Transaction-ID'))) {
      const transactionId = createTransactionId();
      return request.clone({setHeaders: {'X-Transaction-ID': transactionId}});
    }
    return request;
  }
}
