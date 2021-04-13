import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { SortableTableHeaderDirective } from '../../../../../shared/directives/table-sortable-header.directive';
import { TableCompleteComponent } from './table-complete.component';
import { SharedModule } from 'app/shared/shared.module';
import { CloudViewerModule } from '../word-cloud/cloud-viewer.module';
import { LinkModule } from '../../components/link/link.module';

@NgModule({
  imports: [
    SharedModule,
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    SharedModule,
    LinkModule
  ],
  declarations: [TableCompleteComponent, SortableTableHeaderDirective],
  exports: [TableCompleteComponent],
  bootstrap: [TableCompleteComponent]
})
export class TableCompleteComponentModule {}
