import { Component } from '@angular/core';

import { select, Store } from '@ngrx/store';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { State } from 'app/***ARANGO_USERNAME***-store';
import { AppUser, ChangePasswordRequest } from 'app/interfaces';

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

    changePassword(req: ChangePasswordRequest) {
        console.log(req);
    }
}
