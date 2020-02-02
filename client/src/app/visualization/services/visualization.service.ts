import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { Neo4jResults } from '../../interfaces';

@Injectable()
export class VisualizationService {
    readonly visApi = '/api/neo4j';

    constructor(private http: HttpClient) {}

    // TODO: Remove me
    /** Start Test Endpoints */

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

    /**
     * For use with the text-mining data set
     */
    getSomeDiseases() {
        return this.http.get<{result: Neo4jResults}>(
            `${this.visApi}/diseases`
        ).pipe(map(resp => resp.result));
    }

    /** End Test Endpoints */

    /**
     * expandNode will take a node id and return all children
     * of the dept of 1.
     * @param nodeId the node id from the database
     */
    expandNode(nodeId: number) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.visApi}/expand`, {nodeId},
        ).pipe(map(resp => resp.result));
    }
}
