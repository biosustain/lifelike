import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { SortableTableHeaderDirective } from '../../../../../shared/directives/table-sortable-header.directive';
import { TableCompleteComponent } from './table-complete.component';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  declarations: [TableCompleteComponent, SortableTableHeaderDirective],
  exports: [TableCompleteComponent],
  bootstrap: [TableCompleteComponent]
})
export class TableCompleteComponentModule {}
