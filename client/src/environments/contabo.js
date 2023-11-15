(function (window) {
    window.__env = window.__env || {};

    // Whether to run the app in prod mode
    window.__env.production = false;

    // Whether to render UI for ChatGPT playground
    window.__env.chatGPTPlaygroundEnabled = true;

    // Whether we are running with valid KEGG license
    window.__env.keggEnabled = false;

    // Whether to run the app with oauth login
    window.__env.oauthEnabled = false;

    // OAuth issuer URL
    window.__env.oauthIssuer = 'https://keycloak.apps.***ARANGO_DB_NAME***.cloud/auth/realms/master';

    // Client ID of the OAuth application
    window.__env.oauthClientId = '***ARANGO_DB_NAME***-frontend';
  })(this);
