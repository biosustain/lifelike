import { NgModule } from '@angular/core';
import { CloudViewerComponent } from './cloud-viewer.component';
import { WordCloudModule } from 'app/shared/components/word-cloud/word-cloud.module';

const components = [
  CloudViewerComponent
];

@NgModule({
  declarations: components,
  imports: [
    WordCloudModule
  ],
  exports: components,
})
export class CloudViewerModule {

}
