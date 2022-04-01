import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { WorkspaceComponent } from './components/workspace.component';
import { WorkspaceOutletComponent } from './components/workspace-outlet.component';
import { WorkspacePaneComponent } from './components/workspace-pane.component';
import { WorkspaceTabComponent } from './components/workspace-tab.component';

const components = [
  WorkspaceComponent,
  WorkspaceOutletComponent,
  WorkspacePaneComponent,
  WorkspaceTabComponent
];

@NgModule({
  declarations: [
    ...components,
  ],
  exports: [
    ...components,
  ],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class WorkspaceModule { }
