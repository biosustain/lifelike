import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { LifelikeHomePageComponent } from './components/***ARANGO_DB_NAME***-home.component';

@NgModule({
  imports: [
    SharedModule
  ],
  declarations: [
    LifelikeHomePageComponent
  ],
  exports: [
    LifelikeHomePageComponent
  ],
})
export class LifelikeHomeModule {
}
