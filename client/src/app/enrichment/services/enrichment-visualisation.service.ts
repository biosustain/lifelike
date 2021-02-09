import {Injectable, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, Subscription} from 'rxjs';
import {ApiService} from '../../shared/services/api.service';
import {BackgroundTask} from "../../shared/rxjs/background-task";
import {FilesystemObject} from "../../file-browser/models/filesystem-object";
import {mapBlobToBuffer, mapBufferToJson} from "../../shared/utils/files";
import {EnrichmentVisualisationData} from "../components/visualisation/enrichment-visualisation-viewer.component";
import {FilesystemService} from "../../file-browser/services/filesystem.service";
import {MatSnackBar} from '@angular/material/snack-bar';

import {map, mergeMap} from 'rxjs/operators';
import {ErrorHandler} from "../../shared/services/error-handler.service";
import {EnrichmentData} from "../components/visualisation/table/enrichment-table-viewer.component";
import {ENRICHMENT_VISUALISATION_MIMETYPE} from "../providers/enrichment-visualisation.type-provider";

@Injectable()
export class EnrichmentVisualisationService implements OnDestroy {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService) {

  }

  private currentFileId: string;
  file;
  private data;
  object;
  loadTask: BackgroundTask<null, [FilesystemObject, EnrichmentData]>;
  loadSubscription: Subscription;
  unsavedChanges: any;

  ngOnDestroy() {
    this.save().subscribe();
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
            map((data: EnrichmentVisualisationData) => {
              this.data = data;
              this.object = object;
              return {object, data};
            }),
          );
        }),
      ));

    this.loadSubscription = this.loadTask.results$.subscribe();

    this.file = this.loadTask.results$;

    this.loadTask.update();
  }

  get fileId(): string {
    return this.currentFileId;
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  enrichWithGOTerms(): Observable<[]> {
    const geneNames = this.data.entitiesList;
    const organism = !!this.data.organism ? this.data.organism : null;
    let existing = this.data.enrichWithGOTerms && this.data.enrichWithGOTerms[organism + geneNames.sort()];
    if (existing) {
      return new Observable(subscriber => subscriber.next(existing));
    }
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        if (!this.data) {
          this.data = {};
        }
        if (!this.data.enrichWithGOTerms) {
          this.data.enrichWithGOTerms = {};
        }
        return this.data.enrichWithGOTerms[organism + geneNames.sort()] = resp.result;
      })
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
      type: ENRICHMENT_VISUALISATION_MIMETYPE,
    });

    // Push to backend to save
    return this.filesystemService.save([this.fileId], {
      contentValue,
    })
      .pipe(
        this.errorHandler.create({label: 'Update enrichment visualisation'}),
        map(() => {
          this.unsavedChanges.next(false);
          this.snackBar.open('Visualisation saved.', null, {
            duration: 2000,
          });
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
