import '@angular/compiler';
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import 'bootstrap/js/dist/index';

// @ts-nocheck
import { create } from 'rxjs-spy';
import DevToolsPlugin from 'rxjs-spy-devtools-plugin';

const spy = create();
const devtoolsPlugin = new DevToolsPlugin(spy, {
  verbose: true,
});
spy.plug(devtoolsPlugin);

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));


