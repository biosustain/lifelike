import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudService } from './services/word-cloud.service';
import {SortingAlgorithmsComponent} from './sorting/sorting-algorithms.component';
import { WordCloudComponent } from './components/word-cloud.component';

const declarations = [
  WordCloudComponent,
  SortingAlgorithmsComponent,
];

@NgModule({
  declarations,
  imports: [
    CommonModule,
    SharedModule,
  ],
  providers: [
    WordCloudService
  ],
  exports: declarations,
})
export class WordCloudModule { }
