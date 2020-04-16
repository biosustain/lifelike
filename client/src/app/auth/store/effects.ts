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

@Injectable()
export class AuthEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
        private store$: Store<State>,
        private authService: AuthenticationService,
    ) {}

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
                }
                ),
            );
        })
    ));

    loginSuccess$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        withLatestFrom(this.store$.pipe(select(AuthSelectors.selectAuthRedirectUrl))),
        tap(([_, url]) => this.router.navigate([url]))
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
