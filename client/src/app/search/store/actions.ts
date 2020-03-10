import { createAction, props } from '@ngrx/store';
import { FTSResult, SearchQuery } from 'app/interfaces';

export const search = createAction(
    '[Search] Search',
    props<{searchQuery: SearchQuery}>(),
);

export const searchSuccess = createAction(
    '[Search] Search Success',
    props<{results: FTSResult}>(),
);

export const searchPaginate = createAction(
    '[Search] Search Paginate',
    props<{searchQuery: SearchQuery}>(),
);

export const searchPaginateSuccess = createAction(
    '[Search] Search Paginate Success',
    props<{results: FTSResult}>(),
);

export const searchReset = createAction(
    '[Search] Search Reset',
);
