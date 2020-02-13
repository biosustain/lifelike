import { createAction, props, union } from '@ngrx/store';

import { Neo4jColumnMapping, FileNameAndSheets } from 'app/interfaces/neo4j.interface';


export const uploadNeo4jFile = createAction(
    '[Neo4j Prototype] Upload Neo4j File',
    props<{payload: FormData}>(),
);

export const uploadNeo4jFileSuccess = createAction(
    '[Neo4j Prototype] Upload Neo4j File Success',
    props<{payload: FileNameAndSheets}>(),
);

export const uploadNodeMapping = createAction(
    '[Neo4j Prototype] Upload Node Mapping',
    props<{payload: Neo4jColumnMapping}>(),
);

export const uploadNodeMappingSuccess = createAction(
    '[Neo4j Prototype] Upload Node Mapping Success',
);

export const uploadRelationshipMapping = createAction(
    '[Neo4j Prototype] Upload Relationship Mapping',
    props<{payload: Neo4jColumnMapping}>(),
);

export const uploadRelationshipMappingSuccess = createAction(
    '[Neo4j Prototype] Upload Relationship Mapping Success',
);

export const getDbLabels = createAction(
    '[Neo4j Prototype] Get Database Labels',
);

export const getDbLabelsSuccess = createAction(
    '[Neo4j Prototype] Get Database Labels Success',
    props<{payload: string[]}>(),
);

export const getNodeProperties = createAction(
    '[Neo4j Prototype] Get Node Properties',
    props<{payload: string}>(),
);

export const getNodePropertiesSuccess = createAction(
    '[Neo4j Prototype] Get Node Properties Success',
    props<{payload: {[key: string]: string[]}}>(),
);

const all = union({
    getDbLabels,
    getDbLabelsSuccess,
    getNodeProperties,
    getNodePropertiesSuccess,
    uploadNeo4jFile,
    uploadNeo4jFileSuccess,
    uploadNodeMapping,
    uploadNodeMappingSuccess,
    uploadRelationshipMapping,
    uploadRelationshipMappingSuccess,
});

export type Neo4jActions = typeof all;
