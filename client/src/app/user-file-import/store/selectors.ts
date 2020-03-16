import {
    createFeatureSelector,
    createSelector,
    MemoizedSelector,
} from '@ngrx/store';

import { State } from './state';
import { FileNameAndSheets, NodeMappingHelper } from '../../interfaces/user-file-import.interface';

export const userFileImportState: MemoizedSelector<object, State> = createFeatureSelector<State>('user-file-import');

export const selectFileNameAndSheets: MemoizedSelector<object, FileNameAndSheets> = createSelector(
    userFileImportState,
    (state: State): FileNameAndSheets => state.fileNameAndSheets,
);

export const selectDbLabels: MemoizedSelector<object, string[]> = createSelector(
    userFileImportState,
    (state: State): string[] => state.dbLabels,
);

export const selectDbRelationshipTypes: MemoizedSelector<object, string[]> = createSelector(
    userFileImportState,
    (state: State): string[] => state.dbRelationshipTypes,
);

export const selectNodeProperties: MemoizedSelector<object, { [key: string]: string[] }> = createSelector(
    userFileImportState,
    (state: State): { [key: string]: string[] } => state.nodeProperties,
);

export const selectNodeMappingHelper: MemoizedSelector<object, NodeMappingHelper> = createSelector(
    userFileImportState,
    (state: State): NodeMappingHelper => state.nodeMappingHelper,
);
