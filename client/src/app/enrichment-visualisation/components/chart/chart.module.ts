import { NgModule } from '@angular/core';

import { ChartsModule, ThemeService } from 'ng2-charts';

import { SharedModule } from 'app/shared/shared.module';

import { ChartComponent } from './chart.component';

const components = [ChartComponent];

@NgModule({
  declarations: components,
  imports: [SharedModule, ChartsModule],
  exports: components,
  providers: [ThemeService],
})
export class ChartModule {}
