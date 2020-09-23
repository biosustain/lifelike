import {NgModule} from '@angular/core';
import {SharedModule} from '../shared/shared.module';
import {WordCloudComponent} from './word-cloud.component';
import {TagCloudModule} from 'angular-tag-cloud-module';
import {WordCloudService} from './services/word-cloud.service';


@NgModule({
  declarations: [
    WordCloudComponent
  ],
  imports: [
    SharedModule,
    TagCloudModule
  ],
  providers: [
    WordCloudService
  ]
})
export class WordCloudModule {
}
