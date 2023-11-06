import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ErrorDetailsComponent } from './components/error-details/error-details.component';
import TreeViewModule from '../tree-view';

const exports = [ErrorDetailsComponent];

@NgModule({
  imports: [NgbModule, CommonModule, TreeViewModule],
  declarations: [...exports],
  exports,
})
export default class ErrorModule {}
