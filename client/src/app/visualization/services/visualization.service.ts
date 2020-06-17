import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import {
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetReferenceTableDataResult,
    Neo4jResults,
    NewClusterSnippetsPageRequest,
    NewEdgeSnippetsPageRequest,
    ReferenceTableDataRequest,
} from 'app/interfaces';
import { NODE_EXPANSION_LIMIT } from 'app/shared/constants';

@Injectable()
export class VisualizationService {
    readonly visApi = '/api/neo4j';

    constructor(private http: HttpClient) {}

    getBatch(query: string) {
        return this.http.get<{result: Neo4jResults}>(
            `${this.visApi}/batch`, {params: {data: query}}
        ).pipe(map(resp => resp.result));
    }

    /**
     * expandNode will take a node id and return all children
     * of the dept of 1.
     * @param nodeId the node id from the database
     */
    expandNode(nodeId: number, filterLabels: string[], limit: number = NODE_EXPANSION_LIMIT) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.visApi}/expand`, {nodeId, filterLabels, limit},
        ).pipe(map(resp => resp.result));
    }

    getReferenceTableData(request: ReferenceTableDataRequest) {
        return this.http.post<{result: GetReferenceTableDataResult}>(
            `${this.visApi}/get-reference-table-data`, {nodeEdgePairs: request.nodeEdgePairs},
        ).pipe(map(resp => resp.result));
    }

    getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
        return this.http.post<{result: GetEdgeSnippetsResult}>(
            `${this.visApi}/get-snippets-for-edge`, {
                page: request.page,
                limit: request.limit,
                edge: request.queryData,
            }
        ).pipe(
            map(resp => resp.result),
            catchError(error => of(error)),
        );
    }

    getSnippetsForCluster(request: NewClusterSnippetsPageRequest) {
        return this.http.post<{result: GetClusterSnippetsResult}>(
            `${this.visApi}/get-snippets-for-cluster`, {
                page: request.page,
                limit: request.limit,
                edges: request.queryData,
            }
        ).pipe(
            map(resp => resp.result),
            catchError(error => of(error)),
        );
    }
}
