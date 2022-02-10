import { OAuthModuleConfig } from 'angular-oauth2-oidc';

export const authModuleConfig: OAuthModuleConfig = {
  resourceServer: {
    // TODO: These should probably be specified in some kind of environment variable
    allowedUrls: ['/api', 'https://keycloak.apps.***ARANGO_DB_NAME***.cloud'],
    sendAccessToken: true,
  }
};
