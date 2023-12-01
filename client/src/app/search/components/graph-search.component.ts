import { Component, ElementRef, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Observable, Subscription } from 'rxjs';
import { filter, map, shareReplay, startWith, take, tap } from 'rxjs/operators';

import { FTSQueryRecord, FTSResult } from 'app/interfaces';
import { fTSQueryRecordLoadingMock } from 'app/shared/mocks/loading/graph-search';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';
import { ModuleAwareComponent } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { promiseOfOne } from 'app/shared/rxjs/to-promise';

import { GraphSearchParameters } from '../graph-search';
import { GraphSearchService } from '../services/graph-search.service';
import {
  createGraphSearchParamsFromQuery,
  getGraphQueryParams,
  GraphQueryParameters,
} from '../utils/search';

@Component({
  selector: 'app-graph-search',
  templateUrl: './graph-search.component.html',
})
export class GraphSearchComponent implements OnInit, OnDestroy, ModuleAwareComponent {
  @ViewChild('body', { static: false }) body: ElementRef;

  readonly loadTask: BackgroundTask<GraphSearchParameters, FTSResult> = new BackgroundTask(
    (params) => {
      return this.searchService.visualizerSearch(
        params.query,
        params.organism,
        params.page,
        params.limit,
        params.domains,
        params.entities
      );
    }
  );

  @Output() readonly modulePropertiesChange = this.loadTask.values$.pipe(
    map((value) => ({
      title:
        value.query != null && value.query.length
          ? `Knowledge Graph: ${value.query}`
          : 'Knowledge Graph',
      fontAwesomeIcon: 'far fa-life-ring',
    }))
  );
  readonly params$: Observable<GraphSearchParameters> = this.route.queryParams.pipe(
    filter((params) => params.q != null),
    map((params) => createGraphSearchParamsFromQuery(params as GraphQueryParameters)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly resultsList$ = this.loadTask.results$.pipe(
    map(({ result }) => result),
    shareReplay({ refCount: true, bufferSize: 1 })
  );
  readonly results$: Observable<FTSQueryRecord[]> = this.resultsList$.pipe(
    map(({ nodes }) => nodes),
    tap(() => {
      // On each update, scroll to the top of the page
      if (this.body) {
        this.body.nativeElement.scrollTop = 0;
      }
    }),
    startWith(mockArrayOf(fTSQueryRecordLoadingMock)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly collectionSize$ = this.resultsList$.pipe(
    map(({ total }) => total),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  readonly legend$: Observable<Map<string, string>> = this.legendService.getAnnotationLegend().pipe(
    map(
      (legend) =>
        // Keys of the result dict are all lowercase, need to change the first character
        // to uppercase to match Neo4j labels
        new Map(Object.entries(legend).map(([label, { color }]) => [label, color]))
    ),
    startWith(new Map())
  );

  paramSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private searchService: GraphSearchService,
    private legendService: LegendService,
    private workspaceManager: WorkspaceManager
  ) {}

  ngOnInit() {
    this.paramSubscription = this.params$.subscribe((params) => {
      this.loadTask.update(params);
    });
  }

  ngOnDestroy() {
    this.paramSubscription?.unsubscribe();
  }

  refresh() {
    return promiseOfOne(this.params$).then((params) => {
      this.loadTask.update(params);
    });
  }

  search(params: GraphSearchParameters) {
    return this.workspaceManager.navigate(['/search'], {
      queryParams: {
        ...getGraphQueryParams(params),
        t: new Date().getTime(), // Hack so if the person press search without changing anything, we still refresh
      },
    });
  }

  goToPage(page: number) {
    return promiseOfOne(this.params$).then((params) =>
      this.search({
        ...params,
        page,
      })
    );
  }
}
