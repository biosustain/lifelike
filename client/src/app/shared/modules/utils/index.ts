import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AutoCloseTooltipOutOfViewDirective } from './directives/auto-close-tooltip-out-of-view.directive';
import { AddStatusPipe } from './pipes/add-status.pipe';

const exports = [AutoCloseTooltipOutOfViewDirective, AddStatusPipe];

@NgModule({
  imports: [CommonModule],
  declarations: [...exports],
  exports,
})
export default class UtilsModule {}
