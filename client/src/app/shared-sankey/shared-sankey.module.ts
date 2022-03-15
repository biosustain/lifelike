import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyViewDropdownComponent } from './components/view-dropdown.component';
import { SankeyViewConfirmComponent } from './components/view-confirm.component';
import { SankeyViewCreateComponent } from './components/view-create.component';
import { StructureOverviewComponent } from './components/structure-overview/structure-overview.component';

const components = [
  SankeyViewConfirmComponent,
  SankeyViewCreateComponent,
  SankeyViewDropdownComponent,
  StructureOverviewComponent
];

@NgModule({
  imports: [
    SharedModule
  ],
  exports: components,
  declarations: components,
  providers: [],
})
export class SharedSankeyModule {
}
