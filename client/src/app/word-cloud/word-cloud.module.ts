import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudComponent } from './word-cloud.component';
import { WordCloudProjectComponent } from './word-cloud-project.component';
import { WordCloudService } from './services/word-cloud.service';


@NgModule({
  declarations: [
    WordCloudComponent,
    WordCloudProjectComponent,
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
