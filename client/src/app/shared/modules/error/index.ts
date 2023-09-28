import { NgModule } from '@angular/core';

import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ErrorDetailsComponent } from './components/error-details/error-details.component';
import TreeViewModule from '../tree-view';

const exports = [ErrorDetailsComponent];

@NgModule({
  imports: [NgbTooltipModule, TreeViewModule],
  declarations: [...exports],
  exports,
})
export default class ErrorModule {}
