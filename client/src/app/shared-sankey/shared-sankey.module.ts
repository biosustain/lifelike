import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyViewDropdownComponent } from './components/view-dropdown.component';
import { SankeyViewConfirmComponent } from './components/view-confirm.component';

const components = [
  SankeyViewConfirmComponent,
  SankeyViewDropdownComponent
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
