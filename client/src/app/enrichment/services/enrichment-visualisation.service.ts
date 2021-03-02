import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import { map } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ENRICHMENT_VISUALISATION_MIMETYPE } from '../providers/enrichment-visualisation.type-provider';
import { mapBlobToBuffer, mapBufferToJson } from '../../shared/utils/files';
import { EnrichmentVisualisationData } from '../components/visualisation/enrichment-visualisation-viewer.component';

@Injectable()
export class EnrichmentVisualisationService implements OnDestroy {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService) {
    console.log('construct');
  }

  private currentFileId: string;
  cachedResults;
  parameters;
  object;
  loadTask: BackgroundTask<null, any>;
  loadTaskMetaData: BackgroundTask<null, any>;
  load: Observable<any>;
  unsavedChanges: any;
  loaded = false;

  ngOnDestroy() {
    this.save().subscribe();
  }

  set fileId(fileId: string) {
    this.currentFileId = fileId;
    this.loadTaskMetaData = new BackgroundTask(() =>
      this.filesystemService.get(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load enrichment visualisation'}),
        map((value: FilesystemObject, _) => {
          this.object = (value);
          return value;
        }),
      ));
    this.loadTask = new BackgroundTask(() =>
      this.filesystemService.getContent(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load enrichment visualisation'}),
        mapBlobToBuffer(),
        mapBufferToJson<EnrichmentVisualisationData>(),
        map(({parameters, cachedResults}: EnrichmentVisualisationData) => {
          this.cachedResults = (cachedResults);
          this.parameters = (parameters);
          return {parameters, cachedResults};
        })
      ));

    this.load = combineLatest(
      this.loadTaskMetaData.results$,
      this.loadTask.results$
    );

    this.loadTaskMetaData.update();
    this.loadTask.update();
  }

  get fileId(): string {
    return this.currentFileId;
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  enrichWithGOTerms(analysis = 'fisher'): Observable<[]> {
    const geneNames = this.parameters.genes;
    const organism = !!this.parameters.organism ? this.parameters.organism : null;
    const uid = analysis + organism + geneNames.sort();
    // const existing = this.cachedResults.enrichWithGOTerms && this.cachedResults.enrichWithGOTerms[uid];
    // if (existing) {
    //   return new Observable(subscriber => subscriber.next(existing));
    // }
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
      {geneNames, organism, analysis},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        if (!this.cachedResults) {
          this.cachedResults = {};
        }
        if (!this.cachedResults.enrichWithGOTerms) {
          this.cachedResults.enrichWithGOTerms = {};
        }
        return this.cachedResults.enrichWithGOTerms[uid] = resp.result;
      }),
    );
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  getGOSignificance(): Observable<[]> {
    const geneNames = this.parameters.genes;
    const organism = !!this.parameters.organism ? this.parameters.organism : null;
    const uid = organism + geneNames.sort();
    const existing = this.cachedResults.GOSignificance && this.cachedResults.GOSignificance[uid];
    if (existing) {
      return new Observable(subscriber => subscriber.next(existing));
    }
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/get_GO_significance`,
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        if (!this.cachedResults) {
          this.cachedResults = {};
        }
        if (!this.cachedResults.GOSignificance) {
          this.cachedResults.GOSignificance = {};
        }
        return this.cachedResults.GOSignificance[uid] = resp.result;
      }),
    );
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
    const contentValue = new Blob([JSON.stringify({
      parameters: this.parameters,
      cachedResults: this.cachedResults,
    })], {
      type: ENRICHMENT_VISUALISATION_MIMETYPE,
    });

    // Push to backend to save
    return this.filesystemService.save([this.fileId], {
      contentValue,
    })
      .pipe(
        this.errorHandler.create({label: 'Update enrichment visualisation'}),
        map(() => {
          // this.unsavedChanges.next(false);
          this.snackBar.open('Visualisation saved.', null, {
            duration: 2000,
          });
        }),
      );
  }

  matchNCBINodes(importGenes: string[], taxID: string) {
    const existing = this.cachedResults && this.cachedResults.NCBINodes && this.cachedResults.NCBINodes[taxID + importGenes.sort()];
    if (existing) {
      return new Observable(() => existing);
    }
    return this.http.post<{ result: [] }>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {importGenes, taxID},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        this.cachedResults.NCBINodes[taxID + importGenes.sort()] = resp.result;
        return this.cachedResults.NCBINodes[taxID + importGenes.sort()];
      }),
    );
  }
}
