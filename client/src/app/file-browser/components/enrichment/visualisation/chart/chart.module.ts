import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {SharedModule} from 'app/shared/shared.module';

import {ChartComponent} from './chart.component';
import { ChartsModule } from 'ng2-charts';

const components = [
  ChartComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
    ChartsModule
  ],
  exports: components,
})
export class ChartModule {
}
