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
  function?: string;
  gene_name?: string;
  id?: string;
  // Regulon attributes
  left_end_position?: number;
  right_end_position?: number;
  regulondb_id?: string;
  strand?: string;
  // String attributes
  annotation?: string;
  protein_size?: number;
  refseq?: string;
  tax_id?: string;
  // Biological Go attributes
  description?: string;
  // Cellular Go attributes
  // Molecular Go attributes
  alt_id?: string;
  // biocyc attributes

}

export interface NCBIWrapper {
  neo4jID: number;
  x: NCBINode;
  link: string;
}

export interface BiocycWrapper {
  link: string;
  result: BiocycNode;
}

export interface BiocycNode {
  accession: string;
  biocyc_id: string;
  left_end_position: string;
  name: string;
  right_end_position: string;
  strand: string;
  pathways: string[];
}

export interface GoWrapper {
  linkList: string[];
  result: GoNode[];
}

export interface GoNode {
  description: string;
  id: string;
  name: string;
}

export interface RegulonWrapper {
  link: string;
  result: RegulonNode;
}

export interface RegulonNode {
  right_end_position: number;
  left_end_position: number;
  name: string;
  regulondb_id: string;
  strand: string;
  regulator_family: string;
  repressed_by: string[];
  activated_by: string[];
}

export interface StringWrapper {
  link: string;
  result: StringNode;
}

export interface StringNode {
  annotation: string;
  id: string;
  name: string;
  protein_size: number;
  refseq: string;
  tax_id: string;
}

export interface UniprotWrapper {
  link: string;
  result: UniprotNode;
}

export interface UniprotNode {
  function: string;
  gene_name: string;
  id: string;
  name: string;
  pathway: string;
}

export interface EnrichmentWrapper {
  biocyc: BiocycWrapper;
  biologicalGo: GoWrapper;
  cellularGo: GoWrapper;
  molecularGo: GoWrapper;
  regulon: RegulonWrapper;
  string: StringWrapper;
  uniprot: UniprotWrapper;
}

export interface NodeWrapper {
  x?: EnrichmentNode;
  xArray?: EnrichmentNode[];
  g?: NCBINode;
}

@Injectable({
  providedIn: 'root'
})
export class EnrichmentTableService extends AbstractService {
  readonly worksheetAPI = '/api/enrichment-table';
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

  matchNCBINodes(geneNames: string[], organism: string): Observable<NCBIWrapper[]> {
    return this.http.post<{result: NCBIWrapper[]}>(
      `${this.worksheetAPI}/match-ncbi-nodes`,
      {geneNames, organism},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getNCBIEnrichmentDomains(nodeIds): Observable<EnrichmentWrapper[]> {
    return this.http.post<{result: EnrichmentWrapper[]}>(
      `${this.kgAPI}/get-ncbi-nodes/enrichment-domains`,
      {nodeIds},
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}
