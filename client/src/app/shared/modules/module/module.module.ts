import { NgModule } from '@angular/core';

import { ModuleErrorComponent } from './components/module-error/module-error.component';
import { ModuleHeaderComponent } from './components/module-header/module-header.component';
import { ModuleMenuComponent } from './components/module-menu/module-menu.component';
import { ModuleProgressComponent } from './components/module-progress/module-progress.component';

const components = [
  ModuleErrorComponent,
  ModuleHeaderComponent,
  ModuleMenuComponent,
  ModuleProgressComponent,
];

@NgModule({
  declarations: components,
  exports: components,
})
export class ModuleModule {}
