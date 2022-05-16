import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyManyToManyComponent } from './sankey.component';

const components = [
  SankeyManyToManyComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components
})
export class SankeyManyToManyModule {
}
