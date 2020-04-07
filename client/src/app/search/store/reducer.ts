import { Action, createReducer, on } from '@ngrx/store';
import { initialState, State } from './state';
import * as SearchActions from './actions';

export const searchFeatureKey = 'search';

const searchReducer = createReducer(
    initialState,
    on(SearchActions.search, (state, { searchQuery }) => {
        return searchQuery.query === '' ?
        {
            query: '',
            nodes: [],
            total: 0,
            page: 0,
            limit: 0,
            loading: false,
        } : {
            ...state,
            query: searchQuery.query,
            page: searchQuery.page,
            limit: searchQuery.limit,
            loading: true,
        };
    }),
    on(SearchActions.searchSuccess, (state, { results }) => ({
        ...state,
        query: results.query,
        nodes: results.nodes,
        total: results.total,
        page: results.page,
        limit: results.limit,
        loading: false,
    })),
    on(SearchActions.searchPaginateSuccess, (state, { results }) => ({
        ...state,
        query: results.query,
        nodes: [...state.nodes, ...results.nodes],
        total: results.total,
        page: results.page,
        limit: results.limit,
        loading: false,
    })),
    on(SearchActions.searchReset, (_, {}) => (initialState)),
);

export const getNodes = (state: State) => state.nodes;

export const getPage = (state: State) => state.page;

export const getLoading = (state: State) => state.loading;

export const getTotal = (state: State) => state.total;

export const getQuery = (state: State) => state.query;

export const getLimit = (state: State) => state.limit;

export function reducer(state: State, action: Action) {
    return searchReducer(state, action);
}
