import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { LifelikeHomePageComponent } from './components/lifelike-home.component';

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
