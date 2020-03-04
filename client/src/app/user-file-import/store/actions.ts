import { createAction, props, union } from '@ngrx/store';

import { Neo4jColumnMapping, FileNameAndSheets, NodeMappingHelper } from 'app/interfaces/user-file-import.interface';


export const uploadNeo4jFile = createAction(
    '[Importer] Upload Neo4j File',
    props<{payload: FormData}>(),
);

export const uploadNeo4jFileSuccess = createAction(
    '[Importer] Upload Neo4j File Success',
    props<{payload: FileNameAndSheets}>(),
);

export const uploadNodeMapping = createAction(
    '[Importer] Upload Node Mapping',
    props<{payload: Neo4jColumnMapping}>(),
);

export const uploadNodeMappingSuccess = createAction(
    '[Importer] Upload Node Mapping Success',
);

export const getDbLabels = createAction(
    '[Importer] Get Database Labels',
);

export const getDbLabelsSuccess = createAction(
    '[Importer] Get Database Labels Success',
    props<{payload: string[]}>(),
);

export const getDbRelationshipTypes = createAction(
    '[Importer] Get Database Relationship Types',
);

export const getDbRelationshipTypesSuccess = createAction(
    '[Importer] Get Database Relationship Types Success',
    props<{payload: string[]}>(),
);

export const getNodeProperties = createAction(
    '[Importer] Get Node Properties',
    props<{payload: string}>(),
);

export const getNodePropertiesSuccess = createAction(
    '[Importer] Get Node Properties Success',
    props<{payload: {[key: string]: string[]}}>(),
);

export const saveNodeMapping = createAction(
    '[Importer] Save Node Mapping Helper',
    props<{payload: NodeMappingHelper}>(),
);

const all = union({
    getDbLabels,
    getDbLabelsSuccess,
    getNodeProperties,
    getNodePropertiesSuccess,
    getDbRelationshipTypes,
    getDbRelationshipTypesSuccess,
    uploadNeo4jFile,
    uploadNeo4jFileSuccess,
    uploadNodeMapping,
    uploadNodeMappingSuccess,
    saveNodeMapping,
});

export type Neo4jActions = typeof all;
