import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { GraphSearchFormComponent } from './components/graph-search-form.component';
import { GraphSearchComponent } from './components/graph-search.component';
import { SearchRecordNodeComponent } from './components/search-record-node.component';
import { SearchRecordRelationshipsComponent } from './components/search-record-relationships.component';
import { GraphSearchService } from './services/graph-search.service';
import { ContentSearchComponent } from './components/content-search.component';
import { ContentSearchFormComponent } from './components/content-search-form.component';
import { ContentSearchService } from './services/content-search.service';
import { DrawingToolModule } from '../drawing-tool/drawing-tool.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';

const components = [
  GraphSearchComponent,
  GraphSearchFormComponent,
  SearchRecordNodeComponent,
  SearchRecordRelationshipsComponent,
  ContentSearchComponent,
  ContentSearchFormComponent,
];

@NgModule({
  imports: [
    SharedModule,
    DrawingToolModule,
    FileBrowserModule,
  ],
  declarations: components,
  providers: [
    GraphSearchService,
    ContentSearchService,
  ],
  exports: components,
})
export class SearchModule {
}
