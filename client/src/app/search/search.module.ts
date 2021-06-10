import { NgModule } from '@angular/core';

import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { SharedModule } from 'app/shared/shared.module';

import { AdvancedSearchDialogComponent } from './components/advanced-search-dialog.component';
import { ContentSearchComponent } from './components/content-search.component';
import { ContentSearchFormComponent } from './components/content-search-form.component';
import { FileRecordsComponent } from './components/file-records.component';
import { GraphSearchComponent } from './components/graph-search.component';
import { GraphSearchFormComponent } from './components/graph-search-form.component';
import { RejectedSynonymsDialogComponent } from './components/rejected-synonyms-dialog.component';
import { SearchRecordNodeComponent } from './components/search-record-node.component';
import { SearchRecordRelationshipsComponent } from './components/search-record-relationships.component';

import { ContentSearchService } from './services/content-search.service';
import { GraphSearchService } from './services/graph-search.service';

const components = [
  AdvancedSearchDialogComponent,
  ContentSearchComponent,
  ContentSearchFormComponent,
  FileRecordsComponent,
  GraphSearchComponent,
  GraphSearchFormComponent,
  RejectedSynonymsDialogComponent,
  SearchRecordNodeComponent,
  SearchRecordRelationshipsComponent,
];

@NgModule({
  imports: [
    SharedModule,
    DrawingToolModule,
    FileBrowserModule
  ],
  entryComponents: [
    AdvancedSearchDialogComponent,
    RejectedSynonymsDialogComponent,
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
