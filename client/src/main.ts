import '@angular/compiler';
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

// Loading after init of prod mode so we don't hit the issue:
// https://github.com/angular/angular-cli/issues/8340
// ever again.
// tslint:disable-next-line:ordered-imports
import { AppModule } from './app/app.module';


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));


