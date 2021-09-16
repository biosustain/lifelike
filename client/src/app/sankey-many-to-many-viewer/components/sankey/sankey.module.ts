import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyManyToManyComponent } from './sankey.component';
import { ClipboardService } from '../../../shared/services/clipboard.service';

const components = [
  SankeyManyToManyComponent
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
export class SankeyManyToManyModule {
}
