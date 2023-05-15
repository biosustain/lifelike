import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { Observable, combineLatest, ReplaySubject } from 'rxjs';
import { map, mergeMap, switchMap, tap } from 'rxjs/operators';

import { BackgroundTask, TaskResult } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SingleResult } from 'app/shared/schemas/common';

import { BaseEnrichmentDocument, EnrichmentParsedData } from '../models/enrichment-document';
import { EnrichmentService } from './enrichment.service';

export interface EnrichWithGOTermsResult {
  'goTerm': string;
  'goId': string;
  'p-value': any;
  'goLabel': string[];
  'geneNames': string[];
  'gene': string;
}

const MIN_REPRESENTED_NUMBER = 0.0000000001;
const addressPrecisionMistake = d => {
  d['q-value'] = d['q-value'] || MIN_REPRESENTED_NUMBER;
  d['p-value'] = d['p-value'] || MIN_REPRESENTED_NUMBER;
  return d;
};

@Injectable()
export class EnrichmentVisualisationService {

  constructor(protected readonly http: HttpClient,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly snackBar: MatSnackBar,
              protected readonly enrichmentService: EnrichmentService) {
  }

  private currentFileId: string;
  object: FilesystemObject;
  private loadTask: BackgroundTask<string, EnrichmentParsedData> = new BackgroundTask(
      fileId => this.enrichmentService.getContent(
        fileId,
      ).pipe(
        this.errorHandler.create({label: 'Load Statistical Enrichment'}),
        switchMap(this.enrichmentDocument.load)
      )
  );
  enrichmentDocument$ = this.loadTask.results$.pipe(
    map(({result}) => result)
  );
  private loadTaskMetaData: BackgroundTask<string, FilesystemObject> = new BackgroundTask(
    fileId => this.enrichmentService.get(fileId).pipe(
      this.errorHandler.create({label: 'Load Statistical Enrichment'})
    )
  );
  load: Observable<[TaskResult<null, FilesystemObject>, TaskResult<null, EnrichmentParsedData>]>;
  loaded = false;
  private enrichmentDocument: BaseEnrichmentDocument = new BaseEnrichmentDocument();
  context$: Observable<string>;
  fileId$ = this.route.params.pipe(
    map(({fileId}) => fileId)
  );
  object$: Observable<FilesystemObject> = this.fileId$.pipe(
    tap(this.loadTaskMetaData.update),
    switchMap(() => this.loadTaskMetaData.results$),
    map(({result}) => result)
  );

  set fileId(fileId: string) {
    this.currentFileId = fileId;

    this.load = combineLatest(
      this.loadTaskMetaData.results$,
      this.loadTask.results$
    );

    this.fileId$.next(fileId);
  }

  get fileId(): string {
    return this.currentFileId;
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  enrichWithGOTerms(analysis = 'fisher'): Observable<EnrichWithGOTermsResult[]> {
    return this.enrichmentDocument$.pipe(
      map(({result: {genes}, taxID, organism, contexts}) => ({
        geneNames: genes.reduce((o, {matched}) => {
          if (matched) {
            o.push(matched);
          }
          return o;
        }, []),
        organism: `${taxID}/${organism}`,
      })),
      switchMap(({geneNames, organism}) =>
        this.http.post<{ result: [] }>(
          `/api/enrichment-visualisation/enrich-with-go-terms`,
          {geneNames, organism, analysis},
        ).pipe(
          map((data: any) => data.map(addressPrecisionMistake)),
        ),
      ),
    );
  }

  enrichWithContext(term): Observable<string> {
    const {organism, contexts} = this.enrichmentDocument;
    return this.http.post<SingleResult<string>>(
      `/api/enrichment-visualisation/enrich-with-context`,
      {organism, term},
    ).pipe(
      map(({result}) => result)
    );
  }
}
