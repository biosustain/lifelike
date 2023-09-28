import { NgModule } from '@angular/core';

import { AutoCloseTooltipOutOfViewDirective } from './directives/auto-close-tooltip-out-of-view.directive';
import { AddStatusPipe } from './pipes/add-status.pipe';

const exports = [AutoCloseTooltipOutOfViewDirective, AddStatusPipe];

@NgModule({
  declarations: [...exports],
  exports,
})
export class UtilsModule {}
