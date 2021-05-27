import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyComponent } from './sankey.component';
import { ClipboardService } from '../../../shared/services/clipboard.service';

const components = [
  SankeyComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components,
  providers: [ClipboardService]
})
export class SankeyModule {
}
