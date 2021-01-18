import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { WordCloudService } from './services/word-cloud.service';
import { WordCloudComponent } from './word-cloud.component';
import { WordCloudProjectComponent } from './word-cloud-project.component';
import { WordCloudFileNavigatorComponent } from './word-cloud-file-navigator.component';
import {SortingAlgorithmsComponent} from './sorting-algorithms.component';

const declarations = [
  WordCloudComponent,
  WordCloudProjectComponent,
  WordCloudFileNavigatorComponent,
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
