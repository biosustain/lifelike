import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { MatSnackBar } from '@angular/material/snack-bar';

import { map, mergeMap } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { BaseEnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentService } from './enrichment.service';

export interface EnrichWithGOTermsResult {
  'p-value': any;
  'goLabel': string[];
  'geneNames': string[];
  'gene': string;
}

@Injectable()
export class EnrichmentVisualisationService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatSnackBar,
              protected readonly enrichmentService: EnrichmentService) {
  }

  private currentFileId: string;
  object;
  loadTask: BackgroundTask<null, any>;
  loadTaskMetaData: BackgroundTask<null, any>;
  load: Observable<any>;
  unsavedChanges: any;
  loaded = false;
  enrichmentDocument;

  set fileId(fileId: string) {
    const enrichmentDocument = this.enrichmentDocument = new BaseEnrichmentDocument();
    this.currentFileId = fileId;
    this.loadTaskMetaData = new BackgroundTask(() =>
      this.enrichmentService.get(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load Statistical Enrichment'}),
        map((value: FilesystemObject, _) => this.object = value),
      ));
    this.loadTask = new BackgroundTask(() =>
      this.enrichmentService.getContent(
        this.fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load Statistical Enrichment'}),
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
  enrichWithGOTerms(analysis = 'fisher'): Observable<EnrichWithGOTermsResult[]> {
    const {result: {genes}, taxID, organism} = this.enrichmentDocument;
    const geneNames = genes.reduce((o, {matched}) => {
      if (matched) {
        o.push(matched);
      }
      return o;
    }, []);
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
      {geneNames, organism: `${taxID}/${organism}`, analysis},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp)
    );
  }
}
