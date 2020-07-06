import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { SearchBarComponent } from './components/search-bar.component';
import { SearchCollectionPageComponent } from './containers/search-collection-page.component';
import { SearchListComponent } from './components/search-list.component';
import { SearchRecordNodeComponent } from './components/search-record-node.component';
import { SearchRecordRelationshipsComponent } from './components/search-record-relationships.component';
import { SearchService } from './services/search.service';


const components = [
    SearchBarComponent,
    SearchRecordNodeComponent,
    SearchRecordRelationshipsComponent,
    SearchCollectionPageComponent,
    SearchListComponent,
];

@NgModule({
    imports: [
        SharedModule
    ],
    declarations: components,
    providers: [SearchService],
    exports: components,
})
export class SearchModule {}
