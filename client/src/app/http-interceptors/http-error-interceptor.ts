import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

import { Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store/state';
import { SnackbarActions } from 'app/shared/store';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(private store: Store<State>) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(req).pipe(
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
                duration: 10000
              },
            }
          }));
          return throwError('No internet connection');
        } else if (statusCode > 400 && statusCode < 500) {
          return throwError(res);
        } else if (statusCode === 400 || statusCode >= 500) {
          let message = 'The server encountered a problem. No further details are currently available.';
          if (res.error && res.error.message) {
            message = res.error.message;
          }
          this.store.dispatch(SnackbarActions.displaySnackbar({
            payload: {
              message,
              action: 'Dismiss',
              config: {
                verticalPosition: 'top',
                duration: 10000
              },
            }
          }));
          return throwError(res);
        }
        return throwError(res);
      }),
    );
  }
}
