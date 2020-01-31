import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../shared.module';

import { VisualizationComponent } from './components/visualization/visualization.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';

const components = [
  ContextMenuComponent,
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
