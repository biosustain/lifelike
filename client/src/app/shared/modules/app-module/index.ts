import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ModuleErrorComponent } from './components/module-error/module-error.component';
import { ModuleHeaderComponent } from './components/module-header/module-header.component';
import { ModuleMenuComponent } from './components/module-menu/module-menu.component';
import { ModuleProgressComponent } from './components/module-progress/module-progress.component';
import ErrorModule from '../error';
import LoadingIndicatorModule from '../loading-indicator';
import UtilsModule from '../utils';
import ObjectModule from '../object';
import LinkModule from '../link';

const exports = [
  ModuleErrorComponent,
  ModuleHeaderComponent,
  ModuleMenuComponent,
  ModuleProgressComponent,
];

@NgModule({
  imports: [
    CommonModule,
    ErrorModule,
    UtilsModule,
    ObjectModule,
    LinkModule,
    NgbModule,
    LoadingIndicatorModule,
  ],
  declarations: [...exports],
  exports,
})
export default class AppModuleModule {}
