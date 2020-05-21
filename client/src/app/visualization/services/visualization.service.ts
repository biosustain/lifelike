import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import {
    ClusteredNode,
    DuplicateNodeEdgePair,
    DuplicateVisEdge,
    GetClusterDataResult,
    GetClusterGraphDataResult,
    GetSnippetsResult,
    Neo4jResults,
    VisEdge,
    GetReferenceTableDataResult,
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

    getSnippetsFromEdge(edge: VisEdge) {
        return this.http.post<{result: GetSnippetsResult}>(
            `${this.visApi}/get-snippets-from-edge`, {edge},
        ).pipe(map(resp => resp.result));
    }

    getSnippetsFromDuplicateEdge(edge: DuplicateVisEdge) {
        return this.http.post<{result: GetSnippetsResult}>(
            `${this.visApi}/get-snippets-from-duplicate-edge`, {edge},
        ).pipe(map(resp => resp.result));
    }

    // Currently unused
    // getSnippetCountsFromEdges(edges: VisEdge[]) {
    //     return this.http.post<{result: GetSnippetCountsFromEdgesResult}>(
    //         `${this.visApi}/get-snippet-counts-from-edges`, {edges},
    //     ).pipe(map(resp => resp.result));
    // }

    getReferenceTableData(nodeEdgePairs: DuplicateNodeEdgePair[]) {
        return this.http.post<{result: GetReferenceTableDataResult}>(
            `${this.visApi}/get-reference-table-data`, {nodeEdgePairs},
        ).pipe(map(resp => resp.result));
    }

    getClusterGraphData(clusteredNodes: ClusteredNode[]) {
        return this.http.post<{result: GetClusterGraphDataResult}>(
            `${this.visApi}/get-cluster-graph-data`, {clusteredNodes},
        ).pipe(map(resp => resp.result));
    }

    getClusterData(clusteredNodes: ClusteredNode[]) {
        return this.http.post<{result: GetClusterDataResult}>(
            `${this.visApi}/get-cluster-data`, {clusteredNodes}
        ).pipe(map(resp => resp.result));
    }
}
