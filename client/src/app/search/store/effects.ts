import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
    Actions,
    ofType,
    createEffect,
} from '@ngrx/effects';
import { map, concatMap, switchMap, tap } from 'rxjs/operators';
import * as SearchActions from './actions';
import { EMPTY as empty, of } from 'rxjs';
import { SearchService } from '../services/search.service';
import { FTSResult } from 'app/interfaces';


@Injectable()
export class SearchEffects {
    constructor(
        private actions$: Actions,
        private router: Router,
        private searchService: SearchService,
    ) {}

    search = createEffect(() => this.actions$.pipe(
        ofType(SearchActions.search),
        switchMap(({ searchQuery }) => {
            const { query, page, limit } = searchQuery;
            if (query === '') {
                return empty;
            }
            return this.searchService.visualizerSearchTemp(query, page, 10, 'n:db_Literature').pipe(
                map((results: FTSResult) => SearchActions.searchSuccess({results})),
            );
        }),
    ));

    searchSuccess = createEffect(() => this.actions$.pipe(
        ofType(SearchActions.searchSuccess),
        tap(({results}) => this.router.navigate(
            ['search', ''], {queryParams: { q: results.query}})),
    ), {dispatch: false});

    searchPaginate = createEffect(() => this.actions$.pipe(
        ofType(SearchActions.searchPaginate),
        concatMap(({searchQuery}) => {
            const { query, page, limit } = searchQuery;
            return this.searchService.visualizerSearchTemp(query, page, 10, 'n:db_Literature').pipe(
                map((results: FTSResult) => SearchActions.searchPaginateSuccess({results}))
            );
        })
    ));
}
