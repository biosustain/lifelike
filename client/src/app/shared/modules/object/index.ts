import { NgModule } from '@angular/core';

import { ObjectMenuComponent } from './components/object-menu/object-menu.component';
import { ObjectPathComponent } from './components/object-path/object-path.component';
import TreeViewModule from '../tree-view';
import { ProjectIconComponent } from './components/project-icon/project-icon.component';
import { ProjectMenuComponent } from './components/project-menu/project-menu.component';
import { LinkModule } from '../link/link.module';
import { FilesystemObjectTargetDirective } from './directives/filesystem-object-target.directive';

const exports = [
  ObjectMenuComponent,
  ObjectPathComponent,
  ProjectIconComponent,
  ProjectMenuComponent,
  FilesystemObjectTargetDirective,
];

@NgModule({
  imports: [TreeViewModule, LinkModule],
  declarations: [...exports],
  exports,
})
export default class ObjectModule {}
