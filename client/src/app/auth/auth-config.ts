import { environment } from 'environments/environment';

import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
  issuer: environment.oauthIssuer,
  clientId: environment.oauthClientId,
  scope: environment.oauthScopes,
  responseType: 'code',
  redirectUri: window.location.origin + '/projects',
  silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
  useSilentRefresh: true, // Needed for Code Flow to suggest using iframe-based refreshes
  sessionChecksEnabled: true,
  showDebugInformation: true, // Also requires enabling "Verbose" level in devtools
  clearHashAfterLogin: false, // https://github.com/manfredsteyer/angular-oauth2-oidc/issues/457#issuecomment-431807040,
  nonceStateSeparator: 'semicolon' // Real semicolon gets mangled by IdentityServer's URI encoding
};
