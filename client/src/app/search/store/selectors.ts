import {
    createFeatureSelector,
    createSelector,
} from '@ngrx/store';

import { State } from './state';

import * as fromSearch from './reducer';

export const selectSearchState = createFeatureSelector<State>(fromSearch.searchFeatureKey);

export const selectSearchQuery = createSelector(
    selectSearchState,
    fromSearch.getQuery,
);

export const selectSearchRecords = createSelector(
    selectSearchState,
    fromSearch.getNodes,
);

export const selectSearchPage = createSelector(
    selectSearchState,
    fromSearch.getPage,
);

export const selectSearchTotal = createSelector(
    selectSearchState,
    fromSearch.getTotal,
);

export const selectSearchLoading = createSelector(
    selectSearchState,
    fromSearch.getLoading,
);

export const selectSearchLimit = createSelector(
    selectSearchState,
    fromSearch.getLimit,
);
