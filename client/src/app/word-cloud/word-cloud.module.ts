import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudComponent } from './word-cloud.component';
import { WordCloudService } from './services/word-cloud.service';


@NgModule({
  declarations: [
    WordCloudComponent
  ],
  imports: [
    SharedModule,
  ],
  providers: [
    WordCloudService
  ]
})
export class WordCloudModule {
}
