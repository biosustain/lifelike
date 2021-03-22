import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import {SortingAlgorithmsComponent} from './sorting/sorting-algorithms.component';
import { NavigatorCloudViewerComponent } from './components/navigator-cloud-viewer.component';
import { WordCloudModule } from '../../shared/components/word-cloud/word-cloud.module';

const components = [
  NavigatorCloudViewerComponent,
  SortingAlgorithmsComponent,
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
    WordCloudModule,
  ],
  exports: components,
})
export class NavigatorCloudViewerModule {
}
