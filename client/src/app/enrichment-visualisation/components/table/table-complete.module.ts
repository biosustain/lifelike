import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { NgbModalModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

import { SortableTableHeaderDirective } from 'app/shared/directives/table-sortable-header.directive';

import { TableCompleteComponent } from './table-complete.component';
import { LinkModule } from '../link/link.module';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LinkModule,
    NgbTooltipModule,
    NgbTypeaheadModule,
    NgbModalModule,
  ],
  declarations: [TableCompleteComponent, SortableTableHeaderDirective],
  exports: [TableCompleteComponent],
  bootstrap: [TableCompleteComponent],
})
export class TableCompleteComponentModule {}
