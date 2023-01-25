import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { isNil } from "lodash-es";
import { of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { IdType } from "vis-network";

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
  GraphNode,
  GraphRelationship,
  VisNode,
  VisEdge,
  BulkReferenceTableDataRequest,
  GetBulkReferenceTableDataResult,
} from "app/interfaces";

@Injectable()
export class VisualizationService {
  readonly baseUrl = "/api/visualizer";

  constructor(private http: HttpClient) {}


  /**
   * This function is used to modify the API response to a format
   * vis.js will understand. vis.js uses a limited set
   * of properties for rendering the network graph.
   * @param result - a list of nodes and edges for conversion
   */
  convertGraphToVisJSFormat({ nodes, edges }: Neo4jResults, legend: Map<string, string[]>) {
    return {
      nodes: nodes
        .map((n: GraphNode) => this.convertNodeToVisJSFormat(n, legend))
        .filter((val) => val !== null),
      edges: edges.map((e: GraphRelationship) => this.convertEdgeToVisJSFormat(e)),
    };
  }

  convertNodeToVisJSFormat(n: GraphNode, legend: Map<string, string[]>): VisNode {
    if (isNil(n.displayName) || isNil(n.label)) {
      console.error(`Node does not have expected label and displayName properties ${n}`);
      return null;
    }
    const color = legend.get(n.label) ?legend.get(n.label)[0] : "#000000";
    const border = legend.get(n.label) ? legend.get(n.label)[1] : "#000000";
    return {
      ...n,
      expanded: false,
      primaryLabel: n.label,
      font: {
        color,
      },
      color: {
        background: "#FFFFFF",
        border,
        hover: {
          background: "#FFFFFF",
          border,
        },
        highlight: {
          background: "#FFFFFF",
          border,
        },
      },
      label: n.displayName.length > 64 ? n.displayName.slice(0, 64) + "..." : n.displayName,
    };
  }

  convertEdgeToVisJSFormat(e: GraphRelationship): VisEdge {
    return {
      ...e,
      color: {
        color: "#0c8caa",
      },
      label: e.data.description,
      arrows: "to",
    };
  }

  getDocument(id: IdType) {
    return this.http.get<Neo4jResults>(`${this.baseUrl}/document/${id}`);
  }

  /**
   * expandNode will take a node id and return all children
   * of the depth of 1.
   * @param nodeId the node id from the database
   */
  expandNode(nodeId: IdType, filterLabels: string[]) {
    return this.http
      .post<{ result: GetBulkReferenceTableDataResult }>(`${this.baseUrl}/expand`, { nodeId, filterLabels })
      .pipe(map((resp) => resp.result));
  }

  getReferenceTableData(request: ReferenceTableDataRequest) {
    return this.http
      .post<{ result: GetReferenceTableDataResult }>(`${this.baseUrl}/get-reference-table`, request)
      .pipe(map((resp) => resp.result));
  }

  getSnippetsForEdge(request: NewEdgeSnippetsPageRequest) {
    return this.http
      .post<{ result: GetEdgeSnippetsResult }>(`${this.baseUrl}/get-snippets-for-edge`, {
        page: request.page,
        limit: request.limit,
        edge: request.queryData,
      })
      .pipe(
        map((resp) => resp.result),
        catchError((error) => of(error))
      );
  }

  getSnippetsForCluster(request: NewClusterSnippetsPageRequest) {
    return this.http
      .post<{ result: GetClusterSnippetsResult }>(`${this.baseUrl}/get-snippets-for-cluster`, {
        page: request.page,
        limit: request.limit,
        edges: request.queryData,
      })
      .pipe(
        map((resp) => resp.result),
        catchError((error) => of(error))
      );
  }

  getAssociatedTypeSnippetCount(request: AssociatedTypeSnippetCountRequest) {
    return this.http
      .post<{ result: GetAssociatedTypeResult }>(
        `${this.baseUrl}/get-associated-type-snippet-count`,
        {
          source_node: request.source_node,
          associated_nodes: [...request.associated_nodes],
        }
      )
      .pipe(map((resp) => resp.result.associatedData));
  }

  getSnippetsForNodePair(node1Id: IdType, node2Id: IdType, page: number, limit: number) {
    return this.http
      .post<{ result: GetNodePairSnippetsResult }>(`${this.baseUrl}/get-snippets-for-node-pair`, {
        page,
        limit,
        node_1_id: node1Id,
        node_2_id: node2Id,
      })
      .pipe(map((resp) => resp.result));
  }
}
