import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {SharedModule} from 'app/shared/shared.module';

import {ClustergramComponent} from './clustergram.component';

const components = [
  ClustergramComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components,
})
export class ClustergramModule {
}
