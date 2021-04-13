import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { SortableTableHeaderDirective } from 'app/shared/directives/table-sortable-header.directive';
import { TableCompleteComponent } from './table-complete.component';
import { LinkModule } from '../../components/link/link.module';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LinkModule
  ],
  declarations: [TableCompleteComponent, SortableTableHeaderDirective],
  exports: [TableCompleteComponent],
  bootstrap: [TableCompleteComponent]
})
export class TableCompleteComponentModule {}
