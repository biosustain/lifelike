import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { AccountService } from '../services/account.service';

import * as UserActions from './actions';
import { SnackbarActions } from 'app/shared/store';
import { AuthActions } from 'app/auth/store';

import {
    map,
    switchMap,
    exhaustMap,
} from 'rxjs/operators';

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
                ])
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
        ))
    ));
}
