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

export const uploadNeo4jColumnMappingFile = createAction(
    '[Neo4j Prototype] Upload Neo4j Column Mapping File',
    props<{payload: Neo4jColumnMapping}>(),
);

export const uploadNeo4jColumnMappingFileSuccess = createAction(
    '[Neo4j Prototype] Upload Neo4j Column Mapping File Success',
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
    uploadNeo4jColumnMappingFile,
    uploadNeo4jColumnMappingFileSuccess,
});

export type Neo4jActions = typeof all;
