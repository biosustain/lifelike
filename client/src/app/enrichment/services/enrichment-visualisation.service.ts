import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ApiService} from '../../shared/services/api.service';
import {BackgroundTask} from "../../shared/rxjs/background-task";
import {FilesystemObject} from "../../file-browser/models/filesystem-object";
import {mapBlobToBuffer, mapBufferToJson} from "../../shared/utils/files";
import {EnrichmentVisualisationData} from "../components/visualisation/enrichment-visualisation-viewer.component";
import {FilesystemService} from "../../file-browser/services/filesystem.service";

import {map, mergeMap} from 'rxjs/operators';
import {EnrichmentData} from "../components/table/enrichment-table-viewer.component";
import {ErrorHandler} from "../../shared/services/error-handler.service";

@Injectable()
export class EnrichmentVisualisationService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService) {

  }

  private currentFileId: string;
  private file;
  public done_loading: boolean;
  loadTask: BackgroundTask<null, [FilesystemObject, EnrichmentData]>;

  set fileId(file_id: string) {
    this.currentFileId = file_id;

    this.loadTask = new BackgroundTask(() =>
      this.filesystemService.get(
        this.fileId,
        {loadContent: true}
      ).pipe(
        this.errorHandler.create({label : 'Load enrichment table'}),
        mergeMap((object: FilesystemObject) => {
          return object.contentValue$.pipe(
            mapBlobToBuffer(),
            mapBufferToJson<EnrichmentVisualisationData>(),
            map((data: EnrichmentVisualisationData) => [object, data] as [FilesystemObject, EnrichmentVisualisationData]),
          );
        }),
      ));
    this.file = this.loadTask.results$.subscribe();
  }

  get fileId(): string {
    return this.currentFileId;
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  enrichWithGOTerms(geneNames: string[], organism: string): Observable<NCBIWrapper[]> {
    return this.http.post<{ result: NCBIWrapper[] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
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
