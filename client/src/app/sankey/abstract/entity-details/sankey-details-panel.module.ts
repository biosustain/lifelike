import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyNodeDetailsComponent } from '../../components/entity-details/node-details.component';
import { SankeyTraceDetailsComponent } from '../../components/entity-details/trace-details.component';
import { ButtonWithSelectableTextComponent } from '../../components/button-with-selectable-text/button-with-selectable-text.component';

@NgModule({
  declarations: [
    SankeyNodeDetailsComponent,
    SankeyTraceDetailsComponent,
    ButtonWithSelectableTextComponent,
  ],
  imports: [SharedModule],
  exports: [
    SankeyNodeDetailsComponent,
    SankeyTraceDetailsComponent,
    ButtonWithSelectableTextComponent,
  ],
})
export class SankeyDetailsPanelModule {}
