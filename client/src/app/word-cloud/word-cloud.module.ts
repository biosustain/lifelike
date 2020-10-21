import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudComponent } from './word-cloud.component';
import { WordCloudService } from './services/word-cloud.service';

const components = [
  WordCloudComponent,
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
