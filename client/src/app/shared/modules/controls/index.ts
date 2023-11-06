import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ResultControlComponent } from './components/result-control/result-control.component';
import { SearchControlComponent } from './components/search-control/search-control.component';
import { BaseControlComponent } from './components/base-control/base-control.component';
import UtilsModule from '../utils';

const exports = [ResultControlComponent, SearchControlComponent];

@NgModule({
  imports: [NgbModule, UtilsModule, CommonModule],
  exports,
  declarations: [BaseControlComponent, ...exports],
})
export default class ControlsModule {}
