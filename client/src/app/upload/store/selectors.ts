import {
    createFeatureSelector,
    createSelector,
    MemoizedSelector,
} from '@ngrx/store';

import { State } from './state';
import { FileNameAndSheets } from 'app/interfaces/neo4j.interface';

export const neo4jState: MemoizedSelector<object, State> = createFeatureSelector<State>('neo4j');

export const selectFileNameAndSheets: MemoizedSelector<object, FileNameAndSheets> = createSelector(
    neo4jState,
    (state: State): FileNameAndSheets => state.fileNameAndSheets,
);

export const selectDbLabels: MemoizedSelector<object, string[]> = createSelector(
    neo4jState,
    (state: State): string[] => state.dbLabels,
);

export const selectNodeProperties: MemoizedSelector<object, { [key: string]: string[] }> = createSelector(
    neo4jState,
    (state: State): { [key: string]: string[] } => state.nodeProperties,
);
