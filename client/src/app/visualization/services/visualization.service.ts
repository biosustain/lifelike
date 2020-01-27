import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { Neo4jResults } from '../../interfaces';

@Injectable()
export class VisualizationService {
    readonly visApi = '/api/neo4j';

    constructor(private http: HttpClient) {}

    query(queryString: string) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.visApi}`, {query: queryString}
        ).pipe(map(resp => resp.result));
    }

    /**
     * getAllOrganisms will fetch all available organisms
     * within the NEO4J database.
     * ** NOTE ** Use this as
     * a test endpoint only as the database could potentially
     * not have any organisms depending on which database
     * is seeded.
     */
    getAllOrganisms() {
        return this.http.get<{result: Neo4jResults}>(
            `${this.visApi}/organisms`
        ).pipe(map(resp => resp.result));
    }
}
