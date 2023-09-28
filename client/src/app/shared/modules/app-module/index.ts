import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ModuleErrorComponent } from './components/module-error/module-error.component';
import { ModuleHeaderComponent } from './components/module-header/module-header.component';
import { ModuleMenuComponent } from './components/module-menu/module-menu.component';
import { ModuleProgressComponent } from './components/module-progress/module-progress.component';
import ErrorModule from '../error';
import LoadingIndicatorModule from '../loading-indicator';
import { UtilsModule } from '../utils/utils.module';
import ObjectModule from '../object';
import { LinkModule } from '../link/link.module';

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
    NgbTooltipModule,
    LoadingIndicatorModule,
  ],
  declarations: [...exports],
  exports,
})
export default class AppModuleModule {}
