import { environment } from 'environments/environment';

import { OAuthModuleConfig } from 'angular-oauth2-oidc';

export const authModuleConfig: OAuthModuleConfig = {
  resourceServer: {
    allowedUrls: [
      '/api',
      ...(environment.keycloakApiBaseUrl ? [environment.keycloakApiBaseUrl] : []),
    ],
    sendAccessToken: true,
  }
};
