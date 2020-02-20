import {
    createFeatureSelector,
    createSelector,
    MemoizedSelector,
} from '@ngrx/store';

import { State } from './state';
import { FileNameAndSheets, NodeMappingHelper } from '../../interfaces/importer.interface';

export const neo4jState: MemoizedSelector<object, State> = createFeatureSelector<State>('neo4j');

export const selectFileNameAndSheets: MemoizedSelector<object, FileNameAndSheets> = createSelector(
    neo4jState,
    (state: State): FileNameAndSheets => state.fileNameAndSheets,
);

export const selectDbLabels: MemoizedSelector<object, string[]> = createSelector(
    neo4jState,
    (state: State): string[] => state.dbLabels,
);

export const selectDbRelationshipTypes: MemoizedSelector<object, string[]> = createSelector(
    neo4jState,
    (state: State): string[] => state.dbRelationshipTypes,
);

export const selectNodeProperties: MemoizedSelector<object, { [key: string]: string[] }> = createSelector(
    neo4jState,
    (state: State): { [key: string]: string[] } => state.nodeProperties,
);

export const selectNodeMappingHelper: MemoizedSelector<object, NodeMappingHelper> = createSelector(
    neo4jState,
    (state: State): NodeMappingHelper => state.nodeMappingHelper,
);
