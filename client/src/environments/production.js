(function (window) {
    window.__env = window.__env || {};

    // Whether to run the app in prod mode
    window.__env.production = false;

    // Whether to run the app with oauth login
    window.__env.oauthEnabled = false;

    // OAuth issuer URL
    window.__env.oauthIssuer = 'https://keycloak.apps.lifelike.cloud/auth/realms/master';

    // Client ID of the OAuth application
    window.__env.oauthClientId = 'lifelike-frontend';
}(this));
