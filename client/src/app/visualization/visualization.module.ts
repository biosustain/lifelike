import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../shared.module';

import { VisualizationComponent } from './components/visualization.component';

const components = [
  VisualizationComponent,
];

@NgModule({
  declarations: [...components],
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: [...components],
})
export class VisualizationModule { }
