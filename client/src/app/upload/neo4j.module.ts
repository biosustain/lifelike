import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { SharedModule } from '../shared/shared.module';

import { Neo4jUploadComponent } from './components/neo4j-upload.component';
import { Neo4jUploadFileColumnsComponent } from './components/neo4j-upload-file-columns.component';

import { Neo4jService } from './services/neo4j.service';

import { reducer } from './store/reducer';
import { Neo4jEffects } from './store/effects';


const components = [
    Neo4jUploadComponent,
    Neo4jUploadFileColumnsComponent,
];

@NgModule({
    imports: [
        SharedModule,
        EffectsModule.forFeature([Neo4jEffects]),
        StoreModule.forFeature('neo4j', reducer),
    ],
    exports: components,
    declarations: components,
    providers: [
        Neo4jEffects,
        Neo4jService,
    ],
})
export class Neo4jModule {}
