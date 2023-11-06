import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LoadingIndicatorComponent } from './components/loading-indicator/loading-indicator.component';

const exports = [LoadingIndicatorComponent];

@NgModule({
  imports: [CommonModule],
  declarations: [...exports],
  exports,
})
export default class LoadingIndicatorModule {}
