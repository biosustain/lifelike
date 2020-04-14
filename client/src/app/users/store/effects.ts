import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { AccountService } from '../services/account.service';

import * as UserActions from './actions';
import { SnackbarActions } from 'app/shared/store';
import { AuthActions } from 'app/auth/store';

import { ApiHttpError } from 'app/interfaces';

import {
    catchError,
    map,
    switchMap,
    exhaustMap,
} from 'rxjs/operators';
import { from } from 'rxjs';

@Injectable()
export class UserEffects {
    constructor(
        private actions$: Actions,
        private accountService: AccountService,
    ) {}

    updateUser$ = createEffect(() => this.actions$.pipe(
        ofType(UserActions.updateUser),
        exhaustMap(({ userUpdates }) => {
            return this.accountService.updateUser(userUpdates).pipe(
                switchMap(user => [
                    UserActions.updateUserSuccess(),
                    AuthActions.refreshUser({ user }),
                ]),
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

    updateUserSuccess$ = createEffect(() => this.actions$.pipe(
        ofType(UserActions.updateUserSuccess),
        map(_ => SnackbarActions.displaySnackbar(
            {payload: {
                message: 'Update success!',
                action: 'Dismiss',
                config: { duration: 10000 },
            }}
        )),
    ));
}
