import { Component } from '@angular/core';

import { select, Store } from '@ngrx/store';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { State } from 'app/***ARANGO_USERNAME***-store';
import { AppUser, UpdateUserRequest } from 'app/interfaces';
import * as UserActions from '../store/actions';

@Component({
    selector: 'app-user-settings',
    templateUrl: './user-settings.component.html',
    styleUrls: ['./user-settings.component.scss'],
})
export class UserSettingsComponent {

    currentUsers$: Observable<AppUser>;

    constructor(private store: Store<State>) {
        this.currentUsers$ = this.store.pipe(select(AuthSelectors.selectAuthUser));
    }

    changePassword(userUpdates: UpdateUserRequest) {
        this.store.dispatch(UserActions.updateUser({ userUpdates }));
    }
}
