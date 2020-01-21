import {
    createFeatureSelector,
    createSelector,
    MemoizedSelector,
} from '@ngrx/store';

import { State } from './state';
import { FileNameAndSheets } from '../../interfaces/neo4j.interface';

export const neo4jState: MemoizedSelector<object, State> = createFeatureSelector<State>('neo4j');

export const selectFileNameAndSheets: MemoizedSelector<object, FileNameAndSheets> = createSelector(
    neo4jState,
    (state: State): FileNameAndSheets => state.fileNameAndSheets,
);
