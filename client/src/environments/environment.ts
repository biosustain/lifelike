// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

interface EnvironmentVars {
  production: boolean;
  keggEnabled: boolean;
  chatGPTPlaygroundEnabled: boolean;
  oauthEnabled: boolean;
  oauthIssuer: string;
  oauthClientId: string;
  oauthScopes?: string;
  oauthPasswordChangeLink?: string;
  keycloakApiBaseUrl?: string;
  lifelikeVersion: string;
}

// Read environment variables (set by env.js) into the globalThis object
const windowObjectEnvKey = '__env';
const {
  production = false,
  keggEnabled = false,
  chatGPTPlaygroundEnabled = false,
  oauthEnabled = false,
  oauthIssuer,
  oauthClientId,
  oauthScopes = 'openid profile email offline_access',
  oauthPasswordChangeLink,
  keycloakApiBaseUrl,
  lifelikeVersion = '__VERSION__', // This is statically replaced during build time
}: EnvironmentVars = globalThis.window?.[windowObjectEnvKey] || {};

export const environment = {
  production,
  keggEnabled,
  chatGPTPlaygroundEnabled,
  oauthEnabled,
  oauthIssuer,
  oauthClientId,
  oauthScopes,
  oauthPasswordChangeLink,
  keycloakApiBaseUrl,
  lifelikeVersion,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
