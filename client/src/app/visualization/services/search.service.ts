import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import {
    FTSResult,
} from 'app/interfaces';

@Injectable()
export class SearchService {
    readonly searchApi = '/api/search';

    constructor(private http: HttpClient) {}

    fullTextSearch(query: string, page: number = 1, limit: number = 10) {
        return this.http.post<{result: FTSResult}>(
            `${this.searchApi}/search`, {query, page, limit},
        ).pipe(map(resp => resp.result));
    }

    // TODO: Re-enable once we have a proper predictive/autocomplete implemented
    // predictiveSearch(query: string) {
    //     return this.http.post<{result: Neo4jResults}>(
    //         `${this.searchApi}/search`, {query},
    //     ).pipe(map(resp => resp.result));
    // }
}
