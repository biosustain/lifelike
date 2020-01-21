import { Action, createReducer, on } from '@ngrx/store';

import {
    initialState,
    State,
} from './state';

import * as Neo4jActions from './actions';

export const neo4jReducer = createReducer(
    initialState,
    on(
        Neo4jActions.uploadNeo4jFileSuccess,
        (state, action) => ({
            ...state,
            fileNameAndSheets: action.payload,
        }),
    ),
);

export function reducer(state: State, action: Action) {
    return neo4jReducer(state, action);
}
