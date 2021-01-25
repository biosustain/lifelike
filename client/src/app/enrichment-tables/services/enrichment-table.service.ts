import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../shared/services/api.service';
import { TableCell } from 'app/shared/components/table/generic-table.component';
import { EnrichmentAnnotationGenerationRequest } from 'app/file-browser/schema';

@Injectable()
export class EnrichmentTableService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  matchNCBINodes(geneNames: string[], organism: string): Observable<NCBIWrapper[]> {
    return this.http.post<{ result: NCBIWrapper[] }>(
      `/api/enrichment-table/match-ncbi-nodes`,
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  /**
   * Match enrichment domains to given node ids.
   * @param nodeIds list of node ids to match to enrichment domains
   * @param taxID tax id of organism
   */
  getNCBIEnrichmentDomains(nodeIds, taxID: string): Observable<EnrichmentWrapper[]> {
    return this.http.post<{ result: EnrichmentWrapper[] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {nodeIds, taxID},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  annotateEnrichment(request: EnrichmentAnnotationGenerationRequest): Observable<any> {
    return this.http.post(
      `/api/filesystem/annotations/enrichment/generate`,
      {...request},
      this.apiService.getHttpOptions(true)
    ).pipe(
      map((resp: any) => resp.result)
    );
  }
}


export interface Worksheet {
  id: number;
  filename: string;
  sheetname: string;
  neo4jNodeId: number;
  creationDate: string;
  modifiedDate: string;
  contentID: number;
}

export interface Synonym {
  name: string;
}

export interface NCBINode {
  full_name: string;
  id: string;
  locus_tag: string;
  name: string;
}

export interface NCBIWrapper {
  neo4jID: number;
  x: NCBINode;
  link: string;
  s: Synonym;
}

interface BiocycWrapper {
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

interface GoWrapper {
  link: string;
  result: GoNode[];
}

export interface GoNode {
  description: string;
  id: string;
  name: string;
}

interface RegulonWrapper {
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

interface StringWrapper {
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

interface UniprotWrapper {
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
  go: GoWrapper;
  regulon: RegulonWrapper;
  string: StringWrapper;
  uniprot: UniprotWrapper;
  node_id: number;
}
