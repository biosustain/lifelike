import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { SharedModule } from '../shared.module';

import { Neo4jUploadComponent } from './components/neo4j-upload.component';
import { Neo4jUploadNodeComponent } from './components/neo4j-upload-node.component';
import { ImportColumnMappingComponent } from './components/import-column-mapping.component';
import { ImportColumnMappingRowComponent } from './components/import-column-mapping-row.component';
import { ImportColumnNodePropertyMappingRowComponent } from './components/import-column-node-property-mapping-row.component';
import { ImportColumnRelationshipMapperComponent } from './components/import-column-relationship-mapping.component';
import { ImportColumnRelationshipMappingRowComponent } from './components/import-column-relationship-mapping-row.component';

import { Neo4jService } from './services/neo4j.service';

import { reducer } from './store/reducer';
import { Neo4jEffects } from './store/effects';


const components = [
    Neo4jUploadComponent,
    Neo4jUploadNodeComponent,
    ImportColumnMappingComponent,
    ImportColumnMappingRowComponent,
    ImportColumnNodePropertyMappingRowComponent,
    ImportColumnRelationshipMapperComponent,
    ImportColumnRelationshipMappingRowComponent,
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
