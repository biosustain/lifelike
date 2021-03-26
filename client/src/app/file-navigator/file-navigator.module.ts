import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { ObjectNavigatorComponent } from './components/object-navigator.component';
import { AssociatedMapsComponent } from './components/associated-maps.component';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { NavigatorCloudViewerModule } from '../word-cloud/navigator-cloud-viewer.module';



@NgModule({
  declarations: [
    ObjectNavigatorComponent,
    AssociatedMapsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    NavigatorCloudViewerModule,
    FileBrowserModule,
  ]
})
export class FileNavigatorModule { }
