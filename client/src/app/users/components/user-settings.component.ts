import { Component } from '@angular/core';

import { select, Store } from '@ngrx/store';
import { AuthSelectors } from 'app/auth/store';
import { Observable } from 'rxjs';

import { State } from 'app/root-store';
import { LoginResp } from 'app/interfaces';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
})
export class UserSettingsComponent {
  currentUsers$: Observable<LoginResp>;
  activeTab: 'profile' | 'security';

  constructor(private store: Store<State>) {
    this.currentUsers$ = this.store.pipe(select(AuthSelectors.selectAuthUser));
  }
}
