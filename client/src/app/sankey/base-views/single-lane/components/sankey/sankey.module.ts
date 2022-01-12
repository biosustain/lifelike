import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { SankeySingleLaneComponent } from './sankey.component';

const components = [
  SankeySingleLaneComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components
})
export class SankeySingleLaneModule {
}
