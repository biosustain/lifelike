import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    RouterStateSnapshot,
} from '@angular/router';

import { Store, select } from '@ngrx/store';

import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { State } from '../store/state';
import { AuthActions, AuthSelectors } from '../store';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private store: Store<State>) {}

    canActivate(a: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
        return this.store.pipe(
            select(AuthSelectors.selectAuthLoginState),
            map(loggedIn => {
                if (loggedIn) {
                    return true;
                }
                this.store.dispatch(AuthActions.loginRedirect({url: state.url}));
                return false;
            }),
            take(1),
        );
    }
}
