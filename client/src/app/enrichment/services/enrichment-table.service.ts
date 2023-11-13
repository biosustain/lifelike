import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  TextAnnotationGenerationRequest,
  AnnotationGenerationResultSchema,
} from 'app/file-browser/schema';
import { ResultMapping } from 'app/shared/schemas/common';

import { EnrichmentParsedData } from '../models/enrichment-document';

@Injectable()
export class EnrichmentTableService {
  constructor(private http: HttpClient) {}

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  matchNCBINodes(geneNames: string[], organism: string): Observable<NCBIWrapper[]> {
    return this.http
      .post<{ result: NCBIWrapper[] }>('/api/enrichment-table/match-ncbi-nodes', {
        geneNames,
        organism,
      })
      .pipe(map((resp) => resp.result));
  }

  /**
   * Match enrichment domains to given node ids.
   * @param docIds list of document ids to match to enrichment domains
   * @param taxID tax id of organism
   */
  getNCBIEnrichmentDomains(
    docIds: string[],
    taxID: string,
    domains: string[]
  ): Observable<EnrichmentWrapper> {
    return this.http
      .post<{ result: EnrichmentWrapper }>(
        `/api/enrichment-table/get-ncbi-nodes/enrichment-domains`,
        { docIds, taxID, domains }
      )
      .pipe(map((resp) => resp.result));
  }

  annotateEnrichment(
    hashIds: string[],
    request: TextAnnotationGenerationRequest
  ): Observable<ResultMapping<AnnotationGenerationResultSchema>> {
    return this.http.post<ResultMapping<AnnotationGenerationResultSchema>>(
      `/api/filesystem/annotations/generate`,
      { hashIds, ...request }
    );
  }

  refreshEnrichmentAnnotations(hashIds: string[]): Observable<'Success'> {
    return this.http
      .post<{ results: 'Success' }>(`/api/filesystem/annotations/refresh`, { hashIds })
      .pipe(map((resp) => resp.results));
  }

  getAnnotatedEnrichment(hashId: string): Observable<EnrichmentParsedData> {
    return this.http
      .get<{ results: EnrichmentParsedData }>(
        `/api/filesystem/objects/${encodeURIComponent(hashId)}/enrichment/annotations`
      )
      .pipe(map((resp) => resp.results));
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

export interface NCBINode {
  full_name: string;
  name: string;
}

export interface NCBIWrapper {
  geneArangoId: string;
  synonymArangoId: string;
  gene: NCBINode;
  link: string;
  synonym: string;
}

interface BiocycWrapper {
  link: string;
  result: string[] | null;
}

interface GoWrapper {
  link: string;
  result: string[];
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
}

interface UniprotWrapper {
  link: string;
  result: UniprotNode;
}

export interface UniprotNode {
  function: string;
  id: string;
}

interface KeggWrapper {
  result: string[];
  link: string;
}

export interface DomainWrapper {
  biocyc: BiocycWrapper | null;
  go: GoWrapper | null;
  regulon: RegulonWrapper | null;
  string: StringWrapper | null;
  uniprot: UniprotWrapper | null;
  kegg: KeggWrapper | null;
  doc_id: number;
}

export interface EnrichmentWrapper {
  [id: number]: DomainWrapper;
}
