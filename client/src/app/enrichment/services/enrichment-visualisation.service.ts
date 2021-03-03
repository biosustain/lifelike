import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import { map, mergeMap } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { BaseEnrichmentDocument } from '../models/enrichment-document';

@Injectable()
export class EnrichmentVisualisationService implements OnDestroy {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService) {
  }

  private currentFileId: string;
  object;
  loadTask: BackgroundTask<null, any>;
  loadTaskMetaData: BackgroundTask<null, any>;
  load: Observable<any>;
  unsavedChanges: any;
  loaded = false;
  enrichmentDocument;

  ngOnDestroy() {
    this.save().subscribe();
  }

  set fileId(fileId: string) {
    const enrichmentDocument = this.enrichmentDocument = new BaseEnrichmentDocument();
    this.currentFileId = fileId;
    this.loadTaskMetaData = new BackgroundTask(() =>
      this.filesystemService.get(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load enrichment visualisation'}),
        map((value: FilesystemObject, _) => this.object = value),
      ));
    this.loadTask = new BackgroundTask(() =>
      this.filesystemService.getContent(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load enrichment visualisation'}),
        mergeMap((blob: Blob) => enrichmentDocument.load(blob))
      )
    );

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
    const {importGenes: geneNames, taxID, organism, cachedResults} = this.enrichmentDocument;
    const uid = analysis + organism + geneNames.sort();
    const existing = cachedResults.enrichWithGOTerms && cachedResults.enrichWithGOTerms[uid];
    if (existing) {
      return new Observable(subscriber => subscriber.next(existing));
    }
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
      {geneNames, organism: `${taxID}/${organism}`, analysis},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        if (!cachedResults.enrichWithGOTerms) {
          cachedResults.enrichWithGOTerms = {};
        }
        return cachedResults.enrichWithGOTerms[uid] = resp.result;
      }),
    );
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  getGOSignificance(): Observable<[]> {
    const {importGenes: geneNames, taxID, organism, cachedResults} = this.enrichmentDocument;
    const uid = organism + geneNames.sort();
    const existing = cachedResults.GOSignificance && cachedResults.GOSignificance[uid];
    if (existing) {
      return new Observable(subscriber => subscriber.next(existing));
    }
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/get_GO_significance`,
      {geneNames, organism: `${taxID}/${organism}`},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => {
        if (!cachedResults.GOSignificance) {
          cachedResults.GOSignificance = {};
        }
        return cachedResults.GOSignificance[uid] = resp.result;
      }),
    );
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
    return this.enrichmentDocument.save()
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
}
