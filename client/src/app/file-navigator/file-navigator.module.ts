import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';
import { WordCloudModule } from 'app/word-cloud/word-cloud.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { ObjectNavigatorComponent } from './components/object-navigator.component';
import { AssociatedMapsComponent } from './components/associated-maps.component';

@NgModule({
  imports: [SharedModule, WordCloudModule, FileBrowserModule],
  declarations: [ObjectNavigatorComponent, AssociatedMapsComponent],
})
export class FileNavigatorModule {}
