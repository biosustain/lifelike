(function (window) {
    window.__env = window.__env || {};

    // Whether to run the app in prod mode
    window.__env.production = false;

    // Whether to run the app with oauth login
    window.__env.oauthEnabled = false;

    // OAuth issuer URL
    window.__env.issuer = 'https://keycloak.apps.***ARANGO_DB_NAME***.cloud/auth/realms/master';

    // Client ID of the OAuth application
    window.__env.clientId = '***ARANGO_DB_NAME***-frontend';
}(this));