import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, ConnectableObservable, Observable, Subject } from 'rxjs';
import { filter, map, publishReplay, shareReplay, switchMap, takeUntil } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { BackgroundTask, mergeStatuses, MultiTaskStatus } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ExplainService } from 'app/shared/services/explain.service';

import { BaseEnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentService } from './enrichment.service';
import { SingleResult } from '../../shared/schemas/common';

export interface EnrichWithGOTermsResult {
  goTerm: string;
  goId: string;
  'p-value': any;
  goLabel: string[];
  geneNames: string[];
  gene: string;
}

const MIN_REPRESENTED_NUMBER = 0.0000000001;
const addressPrecisionMistake = (d) => {
  d['q-value'] = d['q-value'] || MIN_REPRESENTED_NUMBER;
  d['p-value'] = d['p-value'] || MIN_REPRESENTED_NUMBER;
  return d;
};

@Injectable()
export class EnrichmentVisualisationService implements OnDestroy {

  constructor(
    protected readonly http: HttpClient,
    protected readonly errorHandler: ErrorHandler,
    protected readonly route: ActivatedRoute,
    protected readonly snackBar: MatSnackBar,
    protected readonly enrichmentService: EnrichmentService,
    protected readonly explainService: ExplainService,
  ) {
    this.enrichmentDocument$.connect();
    this.enrichedWithGOTerms$.connect();
    this.object$.connect();
    this.fileId$.subscribe(fileId => {
      this.loadFileMetaDataTask.update(fileId);
      this.loadEnrichmentDocumentTask.update(fileId);
    });
    this.enrichmentDocument$.subscribe(enrichmentDocument => {
      this.enrichWithGOTermsTask.update(enrichmentDocument);
    });
  }

  private destroy$ = new Subject<void>();

  private fileId$: Observable<string> = this.route.params.pipe(
    map(({file_id}) => file_id),
    filter(fileId => Boolean(fileId)),
    shareReplay({bufferSize: 1, refCount: true}),
  );
  private loadFileMetaDataTask: BackgroundTask<string, FilesystemObject> = new BackgroundTask(
    fileId => this.enrichmentService.get(fileId).pipe(
      this.errorHandler.create({label: 'Load Statistical Enrichment'}),
    ),
  );
  private loadEnrichmentDocumentTask: BackgroundTask<string, BaseEnrichmentDocument> = new BackgroundTask(
    fileId => this.enrichmentService.getContent(
      fileId,
    ).pipe(
      this.errorHandler.create({label: 'Load Statistical Enrichment Content'}),
      switchMap(data => {
        const enrichmentDocument = new BaseEnrichmentDocument();
        return enrichmentDocument.load(data).pipe(
          map(() => enrichmentDocument),
        );
      }),
      shareReplay({bufferSize: 1, refCount: true}),
    ),
  );
  private enrichWithGOTermsTask: BackgroundTask<BaseEnrichmentDocument, EnrichWithGOTermsResult[]> = new BackgroundTask(
    enrichmentDocument => this._enrichWithGOTerms(enrichmentDocument).pipe(
      this.errorHandler.create({label: 'Enrich with GO Terms'}),
    ),
  );
  public readonly status$: Observable<MultiTaskStatus> = combineLatest([
    this.loadFileMetaDataTask.status$,
    this.loadEnrichmentDocumentTask.status$,
    this.enrichWithGOTermsTask.status$,
  ]).pipe(
    map(mergeStatuses),
  );
  public readonly enrichmentDocument$: ConnectableObservable<BaseEnrichmentDocument> =
    this.loadEnrichmentDocumentTask.results$.pipe(
      map(({result}) => result),
      takeUntil(this.destroy$),
      publishReplay(1), // tasks executes eagerly
    ) as ConnectableObservable<BaseEnrichmentDocument>;
  public readonly enrichedWithGOTerms$: ConnectableObservable<EnrichWithGOTermsResult[]> =
    this.enrichWithGOTermsTask.results$.pipe(
      map(({result}) => result),
      takeUntil(this.destroy$),
      publishReplay(1), // tasks executes eagerly
    ) as ConnectableObservable<EnrichWithGOTermsResult[]>;
  public readonly object$: ConnectableObservable<FilesystemObject> =
    this.loadFileMetaDataTask.results$.pipe(
      map(({result}) => result),
      takeUntil(this.destroy$),
      publishReplay(1), // tasks executes eagerly
    ) as ConnectableObservable<FilesystemObject>;
  public readonly contexts$ = this.object$.pipe(
    map(({contexts}) => contexts),
  );

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  private _enrichWithGOTerms(
    {
      result: {genes},
      taxID,
      organism,
    }: BaseEnrichmentDocument,
    analysis = 'fisher',
  ): Observable<EnrichWithGOTermsResult[]> {
    const geneNames = genes.reduce((o, {matched}) => {
      if (matched) {
        o.push(matched);
      }
      return o;
    }, []);
    return this.http.post<{ result: [] }>(
      `/api/enrichment-visualisation/enrich-with-go-terms`,
      {geneNames, organism: `${taxID}/${organism}`, analysis: 'fisher'},
    ).pipe(
      map((data: any) => data.map(addressPrecisionMistake)),
    );
  }

  public enrichTermWithContext(term, context?, geneName?): Observable<string> {
    return this.enrichmentDocument$.pipe(
      switchMap(({organism}) =>
        this.http.post<SingleResult<string>>(
          `/api/enrichment-visualisation/enrich-with-context`,
          {organism, term, context, geneName},
        ).pipe(
          map(({result}) => result),
        ),
      ),
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
