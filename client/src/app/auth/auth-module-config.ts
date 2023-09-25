import { compact } from 'lodash-es';
import { environment } from 'environments/environment';

import { OAuthModuleConfig } from 'angular-oauth2-oidc';

export const authModuleConfig: OAuthModuleConfig = {
  resourceServer: {
    allowedUrls: compact(['/api', environment.keycloakApiBaseUrl]),
    sendAccessToken: true,
  },
};
