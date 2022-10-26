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
  AssociatedTypeSnippetCountRequest,
  GetAssociatedTypeResult,
  GetNodePairSnippetsResult,
} from 'app/interfaces';
import { retryWhenOnline } from 'app/shared/rxjs/online-observable';

@Injectable()
export class VisualizationService {
    readonly baseUrl = '/api/visualizer';

    constructor(private http: HttpClient) { }

    getBatch(query: string) {
        return this.http.get<{result: Neo4jResults<any, any>}>(
            `${this.baseUrl}/batch`,
            {params: {data: query}}
        ).pipe(
          map(resp => resp.result)
        );
    }

    /**
     * expandNode will take a node id and return all children
     * of the depth of 1.
     * @param nodeId the node id from the database
     */
    expandNode(nodeId: number, filterLabels: string[]) {
        return this.http.post<{result: Neo4jResults<any, any>}>(
            `${this.baseUrl}/expand`,
            {nodeId, filterLabels},
        ).pipe(map(resp => resp.result));
    }

  getReferenceTableData(request: ReferenceTableDataRequest) {
    return this.http
      .post<{ result: GetReferenceTableDataResult }>(`${this.baseUrl}/get-reference-table-data`, {
        nodeEdgePairs: [...request.nodeEdgePairs].sort(
          (
            { node: { displayName: a1 }, edge: { originalFrom: a2, originalTo: a3 } },
            { node: { displayName: b1 }, edge: { originalFrom: b2, originalTo: b3 } }
          ) => {
            const a = `${a1}${a2}${a3}`;
            const b = `${b1}${b2}${b3}`;
            if (a > b) {
              return -1;
            } else if (a < b) {
              return 1;
            }
            return 0;
          }
        ),
      })
      .pipe(map((resp) => resp.result));
  }

    getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
        return this.http.post<{result: GetEdgeSnippetsResult}>(
            `${this.baseUrl}/get-snippets-for-edge`, {
                page: request.page,
                limit: request.limit,
                edge: request.queryData,
            },
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
        ).pipe(
            map(resp => resp.result),
            catchError(error => of(error)),
        );
    }

  getAssociatedTypeSnippetCount(request: AssociatedTypeSnippetCountRequest) {
    return this.http
      .post<{ result: GetAssociatedTypeResult }>(
        `${this.baseUrl}/get-associated-type-snippet-count`,
        {
          source_node: request.source_node,
          associated_nodes: [...request.associated_nodes].sort((a, b) => a - b),
        }
      )
      .pipe(map((resp) => resp.result.associatedData));
  }

    getSnippetsForNodePair(node1Id: number, node2Id: number, page: number, limit: number) {
      return this.http.post<{result: GetNodePairSnippetsResult}>(
        `${this.baseUrl}/get-snippets-for-node-pair`, {
          page,
          limit,
          node_1_id: node1Id,
          node_2_id: node2Id,
        },
      ).pipe(map(resp => resp.result));
    }
}
