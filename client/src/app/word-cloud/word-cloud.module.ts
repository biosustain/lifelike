import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudService } from './services/word-cloud.service';
import { WordCloudComponent } from './word-cloud.component';
import { WordCloudProjectComponent } from './word-cloud-project.component';
import { WordCloudFileNavigatorComponent } from './word-cloud-file-navigator.component';

const components = [
  WordCloudComponent,
  WordCloudProjectComponent,
  WordCloudFileNavigatorComponent,
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  providers: [
    WordCloudService
  ],
  exports: components,
})
export class WordCloudModule { }
