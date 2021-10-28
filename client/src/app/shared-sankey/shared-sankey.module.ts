import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyViewDropdownComponent } from './components/view-dropdown.component';

@NgModule({
  imports: [
    SharedModule
  ],
  exports: [
    SankeyViewDropdownComponent
  ],
  declarations: [SankeyViewDropdownComponent],
  providers: [],
})
export class SharedSankeyModule {
}
