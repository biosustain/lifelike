import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { WorkspaceComponent } from './components/workspace.component';
import { WorkspaceOutletComponent } from './components/workspace-outlet.component';
import { WorkspacePaneComponent } from './components/workspace-pane.component';
import { WorkspaceTabComponent } from './components/workspace-tab.component';
import { DataTransferDataDirective } from './directives/data-transfer-data.directive';
import { ContextMenuItemDirective } from './directives/context-menu-item.directive';

const exports = [WorkspaceComponent];

@NgModule({
  imports: [SharedModule],
  declarations: [
    WorkspaceOutletComponent,
    WorkspacePaneComponent,
    WorkspaceTabComponent,
    DataTransferDataDirective,
    ContextMenuItemDirective,
    ...exports,
  ],
  exports,
})
export class WorkspaceModule {}
