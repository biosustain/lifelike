import { Injectable } from '@angular/core';
import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AbstractService } from 'app/shared/services/abstract-service';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { Project } from './project-space.service';

export interface Worksheet {
  id: number;
  filename: string;
  sheetname: string;
  neo4jNodeId: number;
  creationDate: string;
  modifiedDate: string;
  contentID: number;
}

export interface NCBINode {
  full_name: string;
  id: string;
  locus_tag: string;
  name: string;
}

export interface EnrichmentNode {
  // Common attributes
  name: string;
  // Uniprot attributes
  gene_name?: string;
  id?: string;
  // Regulon attributes
  left_end_position?: number;
  right_end_position?: number;
  regulondb_id?: string;
  strand?: string;
  // String attributes
  // Biological Go attributes
  description?: string;
  // Cellular Go attributes
  // Molecular Go attributes
  alt_id?: string;
  // Ecocyc attributes
  accession?: string;
  biocyc_id?: string;
}

export interface NCBIWrapper {
  neo4jID: number;
  x: NCBINode;
}

export interface NodeWrapper {
  x?: EnrichmentNode;
  xArray?: EnrichmentNode[];
  g?: NCBINode;
}

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class WorksheetViewerService extends AbstractService {
  readonly worksheetAPI = '/api/worksheet-viewer';
  readonly kgAPI = '/api/knowledge-graph';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getWorksheet(worksheetId): Observable<Worksheet> {
    return this.http.get<Worksheet>(
      `${this.worksheetAPI}/get-neo4j-worksheet/${encodeURIComponent(worksheetId)}`,
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getWorksheetContent(worksheetId): Observable<Worksheet> {
    return this.http.get<Worksheet>(
      `${this.worksheetAPI}/get-neo4j-worksheet/${encodeURIComponent(worksheetId)}/content`,
      this.getHttpOptions(true),
    )
  }

  getNCBINodes(nodeId): Observable<NCBIWrapper[]> {
    return this.http.get<any>(
      `${this.worksheetAPI}/get-ncbi-nodes/${encodeURIComponent(nodeId)}`,
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIUniprot(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/uniprot`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIString(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/string`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIMolecularGo(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/molecular-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIBiologicalGo(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/biological-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBICellularGo(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/cellular-go`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIEcocyc(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/ecocyc`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIRegulon(nodeIds): Observable<NodeWrapper[]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/regulon`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIEnrichmentDomains(nodeIds): Observable<NodeWrapper[][]> {
    return this.http.post<any>(
      `${this.kgAPI}/get-ncbi-nodes/enrichment-domains`,
      {nodeIds: nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}