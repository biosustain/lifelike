import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { ChartComponent } from './chart.component';
import { ChartsModule, ThemeService } from 'ng2-charts';
import { ChartControlsComponent } from './chart-controls.component';

const components = [
  ChartComponent,
  ChartControlsComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
    ChartsModule
  ],
  exports: components,
  providers: [ThemeService]
})
export class ChartModule {
}
