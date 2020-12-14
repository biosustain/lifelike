import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';
import { WordCloudModule } from 'app/word-cloud/word-cloud.module';

import { FileNavigatorComponent } from './file-navigator.component';
import { AssociatedMapsComponent } from './components/associated-maps/associated-maps.component';
import { FileBrowserModule } from '../file-browser/file-browser.module';



@NgModule({
  declarations: [
    FileNavigatorComponent,
    AssociatedMapsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    WordCloudModule,
    FileBrowserModule,
  ]
})
export class FileNavigatorModule { }
