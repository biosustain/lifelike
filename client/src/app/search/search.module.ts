import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { NodeRelationshipComponent } from './components/node-relationship-display.component';
import { SearchBarComponent } from './components/search-bar.component';
import { SearchGraphComponent } from './containers/search-graph.component';
import { SearchCollectionPageComponent } from './containers/search-collection-page.component';
import { SearchListComponent } from './components/search-list.component';
import { SearchRecordNodeComponent } from './components/search-record-node';
import { SearchRecordRelationshipsComponent } from './components/search-record-relationships';
import { SearchService } from './services/search.service';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { reducer } from './store/reducer';
import { SearchEffects } from './store/effects';

const components = [
    NodeRelationshipComponent,
    SearchBarComponent,
    SearchRecordNodeComponent,
    SearchRecordRelationshipsComponent,
    SearchCollectionPageComponent,
    SearchGraphComponent,
    SearchListComponent,
];

@NgModule({
    imports: [
        EffectsModule.forFeature([SearchEffects]),
        StoreModule.forFeature('search', reducer),
        SharedModule
    ],
    declarations: components,
    providers: [SearchService],
    exports: components,
})
export class SearchModule {}
