import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

import { map } from 'rxjs/operators';

import {
    FTSResult,
} from 'app/interfaces';

@Injectable()
export class SearchService {
    readonly searchApi =  `${environment.apiUrl}/search`;

    constructor(private http: HttpClient) {}

    fullTextSearch(query: string, page: number = 1, limit: number = 10) {
        return this.http.post<{result: FTSResult}>(
            `${this.searchApi}/search`, {query, page, limit},
        ).pipe(map(resp => resp.result));
    }
}
