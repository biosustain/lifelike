import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import {
    Neo4jResults,
} from 'app/interfaces';

@Injectable()
export class SearchService {
    readonly searchApi = '/api/search';

    constructor(private http: HttpClient) {}

    searchGraphDatabase(query: string) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.searchApi}/search`, {query},
        ).pipe(map(resp => resp.result));
    }
}
