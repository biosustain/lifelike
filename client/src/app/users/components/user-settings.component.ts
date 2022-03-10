import { Component } from '@angular/core';

import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AuthSelectors } from 'app/auth/store';
import { State } from 'app/root-store';
import { AppUser } from 'app/interfaces';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
})
export class UserSettingsComponent {
  currentUsers$: Observable<AppUser>;
  activeTab: 'profile' | 'security';

  // TODO: Better to have an environment variable for this
  oauthPasswordChangeLink = 'https://keycloak.apps.lifelike.cloud/auth/realms/master/account/#/security/signingin';

  get oauthEnabled() {
    return environment.oauthEnabled;
  }

  constructor(private store: Store<State>) {
    this.currentUsers$ = this.store.pipe(select(AuthSelectors.selectAuthUser));
  }
}
