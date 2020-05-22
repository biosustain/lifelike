import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthenticationService } from '../services/authentication.service';

import { from } from 'rxjs';
import {
    catchError,
    exhaustMap,
    map,
    tap,
    withLatestFrom
} from 'rxjs/operators';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import * as AuthActions from './actions';
import * as AuthSelectors from './selectors';
import { State } from './state';
import { ApiHttpError } from 'app/interfaces';

import * as SnackbarActions from 'app/shared/store/snackbar-actions';
import { MatDialog, MatSnackBar } from '@angular/material';
import {
    TermsOfServiceDialogComponent,
    TERMS_OF_SERVICE
} from 'app/users/components/terms-of-service-dialog/terms-of-service-dialog.component';

@Injectable()
export class AuthEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
        private store$: Store<State>,
        private authService: AuthenticationService,
        private dialog: MatDialog,
        private snackbar: MatSnackBar
    ) {}

    checkTermsOfService$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.checkTermsOfService),
        map(({ credential }) => {
            // Check if cookies to prove user read up to date ToS
            const cookie = this.authService.getCookie('terms_of_service');

            // Check if terms of service is up to date
            const outOfDate = cookie ? new Date(TERMS_OF_SERVICE.updateTimestamp) > new Date(cookie) : false;

            if (!cookie || outOfDate) {
                this.authService.eraseCookie('terms_of_service');

                // If not serve the terms of service dialog
                this.dialog.open(TermsOfServiceDialogComponent, {
                    width: 'fit-content',
                    data: credential
                });
                return AuthActions.termsOfSerivceAgreeing();
            } else {
                return AuthActions.login({credential});
            }
        })
    ));

    termsOfSerivceAgreeing$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.termsOfSerivceAgreeing),
    ), { dispatch: false });

    agreeTermsOfService$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.agreeTermsOfService),
        exhaustMap(({
            credential,
            timeStamp
        }) => {
            this.authService.setCookie('terms_of_service', timeStamp);
            return from([
                AuthActions.login({credential})
            ]);
        })
    ));

    disagreeTermsOfService$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.disagreeTermsOfService),
        exhaustMap(() => {
            return from([
                SnackbarActions.displaySnackbar({payload: {
                    message: 'Access can not be granted until Terms of Service are accepted',
                    action: 'Dismiss',
                    config: { duration: 10000 },
                }})
            ]);
        })
    ));

    login$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.login),
        exhaustMap(({ credential }) => {
            const { email, password } = credential;
            return this.authService.login(email, password).pipe(
                map(user => AuthActions.loginSuccess({user: user.user})),
                catchError((err: HttpErrorResponse) => {
                    const error: ApiHttpError = err.error.apiHttpError;
                    return from([
                        SnackbarActions.displaySnackbar({payload: {
                            message: error.message,
                            action: 'Dismiss',
                            config: { duration: 10000 },
                        }})
                    ]);
                }),
            );
        })
    ));

    loginSuccess$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        withLatestFrom(this.store$.pipe(select(AuthSelectors.selectAuthRedirectUrl))),
        tap(([_, url]) => this.router.navigate([url])),
    ), { dispatch: false });

    loginRedirect$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.loginRedirect),
        tap(_ => this.router.navigate(['/login'])),
    ), { dispatch: false });

    logout$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.logout),
        map(_ => {
            this.authService.logout();
            this.router.navigate(['/']);
            return SnackbarActions.displaySnackbar(
                {payload: {
                    message: 'You are now logged out!',
                    action: 'Dismiss',
                    config: { duration: 5000 },
                }}
            );
        })
    ));
}
