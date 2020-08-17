import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { GraphSearchFormComponent } from './components/graph-search-form.component';
import { GraphSearchComponent } from './components/graph-search.component';
import { SearchRecordNodeComponent } from './components/search-record-node.component';
import { SearchRecordRelationshipsComponent } from './components/search-record-relationships.component';
import { SearchService } from './services/search.service';

const components = [
  GraphSearchFormComponent,
  SearchRecordNodeComponent,
  SearchRecordRelationshipsComponent,
  GraphSearchComponent,
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
