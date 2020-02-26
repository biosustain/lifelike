import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import {
    ClusteredNode,
    GetClusterGraphDataResult,
    GetSnippetCountsFromEdgesResult,
    GetSnippetsResult,
    Neo4jResults,
    VisEdge,
    NodeEdgePair,
    GetReferenceTableDataResult,
} from 'app/interfaces';
import { NODE_EXPANSION_LIMIT } from 'app/shared/constants';

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
    expandNode(nodeId: number, limit: number = NODE_EXPANSION_LIMIT) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.visApi}/expand`, {nodeId, limit},
        ).pipe(map(resp => resp.result));
    }

    getSnippetsFromEdge(edge: VisEdge) {
        return this.http.post<{result: GetSnippetsResult}>(
            `${this.visApi}/get-snippets-from-edge`, {edge},
        ).pipe(map(resp => resp.result));
    }

    getSnippetCountsFromEdges(edges: VisEdge[]) {
        return this.http.post<{result: GetSnippetCountsFromEdgesResult}>(
            `${this.visApi}/get-snippet-counts-from-edges`, {edges},
        ).pipe(map(resp => resp.result));
    }

    getReferenceTableData(nodeEdgePairs: NodeEdgePair[]) {
        return this.http.post<{result: GetReferenceTableDataResult}>(
            `${this.visApi}/get-reference-table-data`, {nodeEdgePairs},
        ).pipe(map(resp => resp.result));
    }

    getClusterGraphData(clusteredNodes: ClusteredNode[]) {
        return this.http.post<{result: GetClusterGraphDataResult}>(
            `${this.visApi}/get-cluster-graph-data`, {clusteredNodes},
        ).pipe(map(resp => resp.result));
    }

    searchGraphDatabase(query: string) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.visApi}/search`, {query},
        ).pipe(map(resp => resp.result));
    }
}
