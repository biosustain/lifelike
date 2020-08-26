import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { ApiHttpError } from 'app/interfaces';
import { AuthActions } from 'app/auth/store';
import { SnackbarActions } from 'app/shared/store';
import {
  JWT_AUTH_TOKEN_EXPIRED,
  JWT_AUTH_TOKEN_INVALID,
  JWT_REFRESH_TOKEN_EXPIRED,
  JWT_REFRESH_TOKEN_INVALID,
} from 'app/shared/constants';


/**
 * AuthenticationInterceptor is used to intercept all requests
 * and add a JWT token if it exists into the request. It will
 * attempt to refresh the token if it expires.
 */
@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {

    constructor(
        private auth: AuthenticationService,
        private store: Store<State>,
        private router: Router,
    ) {}

    intercept(req: HttpRequest<any>, next: HttpHandler) {
        return next.handle(req).pipe(
            catchError((res: HttpErrorResponse) => {
                const statusCode = res.status;
                const error: ApiHttpError = res.error.apiHttpError;
                if (statusCode === 401) {
                    if (error.message === JWT_REFRESH_TOKEN_EXPIRED || error.message === JWT_REFRESH_TOKEN_INVALID ||
                        error.message === JWT_AUTH_TOKEN_INVALID) {
                        // Clear any previous login state which forces users to log out
                        // and log in again if token has been expired or invalid
                        this.store.dispatch(AuthActions.loginReset());
                        this.store.dispatch(SnackbarActions.displaySnackbar({payload: {
                            message: 'Session expired. Please login again.',
                            action: 'Dismiss',
                            config: { duration: 10000 },
                        }}));
                        this.router.navigate(['/login']);
                        return throwError(res);
                    } else {
                        // Attempt to refresh the token
                        return this.auth.refresh().pipe(
                            switchMap(() => next.handle(this.updateAuthHeader(req))),
                        );
                    }
                }
                return throwError(res);
            }),
        );
    }

    /**
     * Allow auth header to be updated with new access jwt
     * @param request - request with auth ehader your trying to modify
     */
    updateAuthHeader(request: HttpRequest<any>) {
        return request.clone({
        setHeaders: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        },
        });
    }
}
