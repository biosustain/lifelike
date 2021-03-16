import { NgModule } from '@angular/core';
import { DsfgsdfgcloudViewerComponent } from './dsfgsdfgcloud-viewer.component';
import { WordCloudModule } from '../../../../../shared/components/word-cloud/word-cloud.module';

const components = [
  DsfgsdfgcloudViewerComponent
];

@NgModule({
  declarations: components,
  imports: [
    WordCloudModule
  ],
  exports: components,
})
export class SdfgsdfcloudViewerModule {

}
