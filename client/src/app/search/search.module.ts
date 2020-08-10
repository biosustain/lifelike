import {NgModule} from '@angular/core';
import {SharedModule} from 'app/shared/shared.module';

import {SearchFormComponent} from './components/search-form.component';
import {SearchComponent} from './components/search.component';
import {SearchRecordNodeComponent} from './components/search-record-node.component';
import {SearchRecordRelationshipsComponent} from './components/search-record-relationships.component';
import {SearchService} from './services/search.service';
import {FileRecordsComponent} from './components/file-records.component';

const components = [
  SearchFormComponent,
  SearchRecordNodeComponent,
  SearchRecordRelationshipsComponent,
  FileRecordsComponent,
  SearchComponent,
];

@NgModule({
  imports: [
    SharedModule,
  ],
  declarations: components,
  providers: [SearchService],
  exports: components,
})
export class SearchModule {
}
