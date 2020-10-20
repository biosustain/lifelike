import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { FileNavigatorComponent } from './file-navigator.component';



@NgModule({
  declarations: [FileNavigatorComponent],
  imports: [
    CommonModule,
    SharedModule,
  ]
})
export class FileNavigatorModule { }
