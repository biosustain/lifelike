import { Component } from '@angular/core';

import { AuthenticationService } from 'app/auth/services/authentication.service';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
})
export class UserSettingsComponent {
  activeTab: 'profile' | 'security';

  // TODO: Better to have an environment variable for this
  oauthPasswordChangeLink =
    'https://keycloak.apps.lifelike.cloud/auth/realms/master/account/#/security/signingin';

  get oauthEnabled() {
    return environment.oauthEnabled;
  }

  constructor(protected readonly authService: AuthenticationService) {}
}
