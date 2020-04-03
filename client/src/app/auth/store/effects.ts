import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { AuthenticationService } from '../services/authentication.service';

import { map, switchMap } from 'rxjs/operators';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import * as AuthActions from './actions';

@Injectable()
export class AuthEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
        private authService: AuthenticationService,
    ) {}

    login$ = createEffect(() => this.actions$.pipe(
        ofType(AuthActions.login),
        switchMap(({ credential }) => {
            const { email, password } = credential;
            return this.authService.login(email, password).pipe(
                map(user => AuthActions.loginSuccess(user)),
            );
        })
    ));
}
