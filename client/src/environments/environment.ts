// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

interface EnvironmentVars {
  production: boolean;
  oauthEnabled: boolean;
  testVar: string;
  oauthIssuer: string;
  oauthClientId: string;
  ***ARANGO_DB_NAME***Version: string;
}

// Read environment variables (set by env.js) from browser window
const browserWindow = window || {};
const envAccessor = '__env';
const browserWindowEnv = (browserWindow.hasOwnProperty(envAccessor) ? browserWindow[envAccessor] : {}) as EnvironmentVars;

export const environment = {
  production: browserWindowEnv.production || false,
  oauthEnabled: browserWindowEnv.oauthEnabled || false,
  oauthIssuer: browserWindowEnv.oauthIssuer || 'https://example/auth/master',
  oauthClientId: browserWindowEnv.oauthClientId || 'client',
  ***ARANGO_DB_NAME***Version: '__VERSION__', // This is replaced during the docker build stage
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
