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
    NodeAssociatedTypesRequest,
    GetAssociatedTypeResult,
} from 'app/interfaces';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable()
export class VisualizationService extends AbstractService {
    readonly baseUrl = '/api/visualizer';

    constructor(auth: AuthenticationService , http: HttpClient) {
        super(auth, http);
    }

    getBatch(query: string) {
        return this.http.get<{result: Neo4jResults}>(
            `${this.baseUrl}/batch`,
            {params: {data: query}, ...this.getHttpOptions(true)}
        ).pipe(map(resp => resp.result));
    }

    /**
     * expandNode will take a node id and return all children
     * of the depth of 1.
     * @param nodeId the node id from the database
     */
    expandNode(nodeId: number, filterLabels: string[]) {
        return this.http.post<{result: Neo4jResults}>(
            `${this.baseUrl}/expand`,
            {nodeId, filterLabels},
            {...this.getHttpOptions(true)}
        ).pipe(map(resp => resp.result));
    }

    getReferenceTableData(request: ReferenceTableDataRequest) {
        return this.http.post<{result: GetReferenceTableDataResult}>(
            `${this.baseUrl}/get-reference-table-data`,
            {nodeEdgePairs: request.nodeEdgePairs},
            {...this.getHttpOptions(true)}
        ).pipe(map(resp => resp.result));
    }

    getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
        return this.http.post<{result: GetEdgeSnippetsResult}>(
            `${this.baseUrl}/get-snippets-for-edge`, {
                page: request.page,
                limit: request.limit,
                edge: request.queryData,
            },
            {...this.getHttpOptions(true)}
        ).pipe(
            map(resp => resp.result),
            catchError(error => of(error)),
        );
    }

    getSnippetsForCluster(request: NewClusterSnippetsPageRequest) {
        return this.http.post<{result: GetClusterSnippetsResult}>(
            `${this.baseUrl}/get-snippets-for-cluster`, {
                page: request.page,
                limit: request.limit,
                edges: request.queryData,
            },
            {...this.getHttpOptions(true)}
        ).pipe(
            map(resp => resp.result),
            catchError(error => of(error)),
        );
    }

    getAssociatedTypesForNode(request: NodeAssociatedTypesRequest) {
        return this.http.post<{result: GetAssociatedTypeResult}>(
            `${this.baseUrl}/get-node-associated-types`, {
                node_id: request.node_id,
                to_label: request.to_label,
            },
            {...this.getHttpOptions(true)}
        ).pipe(
            map(resp => resp.result.associatedData),
            catchError(error => of(error)),
        );
    }
}
