import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Observable, Subject } from 'rxjs';
import { filter, map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ExplainService } from 'app/shared/services/explain.service';
import { SingleResult } from 'app/shared/schemas/common';
import { debug } from 'app/shared/rxjs/debug';
import { addStatus, mergeStatuses, MultiPipeStatus } from 'app/shared/pipes/add-status.pipe';

import { BaseEnrichmentDocument, EnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentService } from './enrichment.service';

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

export interface ChatGPTResponse extends SingleResult<string> {
  query_params: object;
}

@Injectable()
export class EnrichmentVisualisationService implements OnDestroy {
  constructor(
    protected readonly http: HttpClient,
    protected readonly errorHandler: ErrorHandler,
    protected readonly route: ActivatedRoute,
    protected readonly snackBar: MatSnackBar,
    protected readonly enrichmentService: EnrichmentService,
    protected readonly explainService: ExplainService
  ) {}

  private destroy$ = new Subject<void>();

  private fileId$: Observable<string> = this.route.params.pipe(
    map(({ file_id }) => file_id),
    filter((fileId) => Boolean(fileId)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  public readonly enrichmentDocument$: Observable<BaseEnrichmentDocument> = this.fileId$.pipe(
    switchMap((fileId) =>
      this.enrichmentService.getContent(fileId).pipe(
        this.errorHandler.create({ label: 'Load Statistical Enrichment Content' }),
        switchMap((data) => {
          const enrichmentDocument = new BaseEnrichmentDocument();
          return enrichmentDocument.load(data).pipe(map(() => enrichmentDocument));
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      )
    ),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  ) as Observable<BaseEnrichmentDocument>;
  public readonly enrichedWithGOTerms$: Observable<EnrichWithGOTermsResult[]> =
    this.enrichmentDocument$.pipe(
      switchMap((enrichmentDocument) =>
        this._enrichWithGOTerms(enrichmentDocument).pipe(
          this.errorHandler.create({ label: 'Enrich with GO Terms' })
        )
      ),
      takeUntil(this.destroy$),
      shareReplay({ bufferSize: 1, refCount: true })
    ) as Observable<EnrichWithGOTermsResult[]>;
  public readonly object$: Observable<FilesystemObject> = this.fileId$.pipe(
    switchMap((fileId) =>
      this.enrichmentService
        .get(fileId)
        .pipe(this.errorHandler.create({ label: 'Load Statistical Enrichment' }))
    ),
    debug('object'),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  ) as Observable<FilesystemObject>;

  public readonly status$: Observable<
    MultiPipeStatus<[FilesystemObject, EnrichmentDocument, EnrichWithGOTermsResult]>
  > = combineLatest([
    this.object$.pipe(addStatus()),
    this.enrichmentDocument$.pipe(addStatus()),
    this.enrichedWithGOTerms$.pipe(addStatus()),
  ]).pipe(map((statuses) => mergeStatuses(statuses) as any));
  public readonly contexts$: Observable<string[]> = this.object$.pipe(
    debug('contexts'),
    map(({ contexts }) => contexts),
    shareReplay({ bufferSize: 1, refCount: true })
  ) as Observable<string[]>;

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  private _enrichWithGOTerms(
    { result: { genes }, taxID, organism }: BaseEnrichmentDocument,
    analysis = 'fisher'
  ): Observable<EnrichWithGOTermsResult[]> {
    const geneNames = genes.reduce((o, { matched }) => {
      if (matched) {
        o.push(matched);
      }
      return o;
    }, []);
    return this.http
      .post<{ result: [] }>(`/api/enrichment-visualisation/enrich-with-go-terms`, {
        geneNames,
        organism: `${taxID}/${organism}`,
        analysis: 'fisher',
      })
      .pipe(map((data: any) => data.map(addressPrecisionMistake)));
  }

  public enrichTermWithContext(term, context?, geneName?): Observable<ChatGPTResponse> {
    return this.enrichmentDocument$.pipe(
      switchMap(({ organism }) =>
        this.http
          .post<ChatGPTResponse>(`/api/enrichment-visualisation/enrich-with-context`, {
            organism,
            term,
            context,
            geneName,
          })
      )
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
