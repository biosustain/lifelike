import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { FileNavigatorComponent } from './file-navigator.component';
import { AssociatedMapsComponent } from './components/associated-maps/associated-maps.component';



@NgModule({
  declarations: [
    FileNavigatorComponent,
    AssociatedMapsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
  ]
})
export class FileNavigatorModule { }
