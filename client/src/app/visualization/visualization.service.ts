import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

@Injectable()
export class VisualizationService {
    readonly visApi = '/api/graph/';

    constructor(private http: HttpClient) {}

    query(queryString: string) {
        return this.http.post<{result: {nodes: any[], edges: any[]}}>(
            `${this.visApi}`, {query: queryString}
        ).pipe(map(resp => resp.result));
    }
}
