import { NgModule } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { SharedModule } from 'app/shared/shared.module';

import { SortingAlgorithmsComponent } from './sorting/sorting-algorithms.component';
import { WordCloudComponent } from './components/word-cloud.component';
import { WordCloudAnnotationFilterComponent } from './components/word-cloud-annotation-filter/word-cloud-annotation-filter.component';
import { AnnotationFilterComponent } from './components/annotation-filter/annotation-filter.component';

const exports = [WordCloudComponent];

@NgModule({
  imports: [SharedModule, ScrollingModule],
  declarations: [
    AnnotationFilterComponent,
    SortingAlgorithmsComponent,
    WordCloudAnnotationFilterComponent,
    ...exports,
  ],
  exports,
})
export class WordCloudModule {}
