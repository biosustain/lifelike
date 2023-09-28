import { NgModule } from '@angular/core';

import { LoadingIndicatorComponent } from './components/loading-indicator/loading-indicator.component';

const exports = [LoadingIndicatorComponent];

@NgModule({
  imports: [],
  declarations: [...exports],
  exports,
})
export default class LoadingIndicatorModule {}
