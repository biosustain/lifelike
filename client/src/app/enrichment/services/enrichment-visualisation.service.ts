import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ApiService} from '../../shared/services/api.service';
import {BackgroundTask} from "../../shared/rxjs/background-task";
import {FilesystemObject} from "../../file-browser/models/filesystem-object";
import {mapBlobToBuffer, mapBufferToJson} from "../../shared/utils/files";
import {EnrichmentVisualisationData} from "../components/visualisation/enrichment-visualisation-viewer.component";
import {FilesystemService} from "../../file-browser/services/filesystem.service";
import {MatSnackBar} from '@angular/material/snack-bar';

import {map, mergeMap} from 'rxjs/operators';
import {EnrichmentData} from "../components/table/enrichment-table-viewer.component";
import {ErrorHandler} from "../../shared/services/error-handler.service";
import {MAP_MIMETYPE} from "../../drawing-tool/providers/map.type-provider";

@Injectable()
export class EnrichmentVisualisationService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService) {

  }

  private currentFileId: string;
  file;
  private data;
  loadTask: BackgroundTask<null, [FilesystemObject, EnrichmentData]>;
  unsavedChanges: any;

  ngOnDestroy() {
    this.save()
  }

  set fileId(file_id: string) {
    this.currentFileId = file_id;
    this.loadTask = new BackgroundTask(() =>
      this.filesystemService.get(
        this.fileId,
        {loadContent: true}
      ).pipe(
        this.errorHandler.create({label: 'Load enrichment table'}),
        mergeMap((object: FilesystemObject) => {
          return object.contentValue$.pipe(
            mapBlobToBuffer(),
            mapBufferToJson<EnrichmentVisualisationData>(),
            map((data: EnrichmentVisualisationData) => [object, data] as [FilesystemObject, EnrichmentVisualisationData]),
          );
        }),
      ));
    this.file = this.loadTask.results$;

    this.loadTask.update();
  }

  get fileId(): string {
    return this.currentFileId;
  }

  loadTableTask() {
    this.loadTableTask = new BackgroundTask(() => this.filesystemService.get(this.fileId, {
      loadContent: true,
    }).pipe(
      this.errorHandler.create({label: 'Load enrichment table'}),
      mergeMap((object: FilesystemObject) => {
        return object.contentValue$.pipe(
          mapBlobToBuffer(),
          mapBufferToJson<EnrichmentData>(),
          map((data: EnrichmentData) => [object, data] as [FilesystemObject, EnrichmentData]),
        );
      }),
    ));
    this.loadTableTaskSubscription = this.loadTableTask.results$.subscribe((result) => {
      const [object, data] = result.result;
      // parse the file content to get gene list and organism tax id and name
      this.object = object;
      this.data = data;
      this.emitModuleProperties();
      const resultArray = data.data.split('/');
      this.importGenes = resultArray[0]
        .split(',')
        .filter((gene) => gene !== '');
      this.taxID = resultArray[1];
      if (this.taxID === '562' || this.taxID === '83333') {
        this.taxID = '511145';
      } else if (this.taxID === '4932') {
        this.taxID = '559292';
      }
      this.organism = resultArray[2];
      // parse for column order/domain input
      if (resultArray.length > 3) {
        if (resultArray[3] !== '') {
          this.domains = resultArray[3].split(',');
          this.columnOrder = resultArray[3].split(',');
          if (this.columnOrder.includes('Regulon')) {
            const index = this.columnOrder.indexOf('Regulon');
            this.columnOrder.splice(index + 1, 0, 'Regulon 3');
            this.columnOrder.splice(index + 1, 0, 'Regulon 2');
          }
        }
      } else {
        // Default view for existing Visualisations
        this.domains = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
        this.columnOrder = ['Regulon', 'Regulon 2', 'Regulon 3', 'UniProt', 'String', 'GO', 'Biocyc'];
      }
      this.initializeHeaders();
      this.removeDuplicates(this.importGenes);
      this.matchNCBINodes();
    });
    this.loadTableTask.update();


    let existing = this.data && this.data.enrichmentTable && this.data.enrichmentTable[organism + geneNames.sort()];
    if (existing) {
      return new Observable(() => existing)
    }
    return this.http.post<{ result: [] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => this.data.enrichmentTable[organism + geneNames.sort()] = resp.result)
    );

  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  enrichWithGOTerms(geneNames: string[], organism: string): Observable<[]> {
    let existing = this.data && this.data.enrichWithGOTerms && this.data.enrichWithGOTerms[organism + geneNames.sort()];
    if (existing) {
      return new Observable(() => existing)
    }
    return this.http.post<{ result: [] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => this.data.enrichWithGOTerms[organism + geneNames.sort()] = resp.result)
    );
  }

  /**
   * Match enrichment domains to given node ids.
   * @param nodeIds list of node ids to match to enrichment domains
   * @param taxID tax id of organism
   */
  getNCBIEnrichmentDomains(nodeIds, taxID: string): Observable<[]> {
    let existing = this.data && this.data.NCBIEnrichmentDomains && this.data.NCBIEnrichmentDomains[taxID + nodeIds.sort()];
    if (existing) {
      return new Observable(() => existing)
    }
    return this.http.post<{ result: [] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {nodeIds, taxID},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => this.data.NCBIEnrichmentDomains[taxID + nodeIds.sort()] = resp.result),
    );
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
    const contentValue = new Blob([JSON.stringify(this.data)], {
      type: MAP_MIMETYPE,
    });

    // Push to backend to save
    return this.filesystemService.save([this.fileId], {
      contentValue,
    })
      .pipe(
        this.errorHandler.create({label: 'Update enrichment visualisation'}),
        map(() => {
          this.unsavedChanges.next(false)
          this.snackBar.open('Visualisation saved.', null, {
            duration: 2000,
          })
        })
      );
  }

  matchNCBINodes(importGenes: string[], taxID: string) {
    let existing = this.data && this.data.NCBINodes && this.data.NCBINodes[taxID + importGenes.sort()];
    if (existing) {
      return new Observable(() => existing)
    }
    return this.http.post<{ result: [] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {importGenes, taxID},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        this.data.NCBINodes[taxID + importGenes.sort()] = resp.result
        return this.data.NCBINodes[taxID + importGenes.sort()]
      }),
    );
  }
}
