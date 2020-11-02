import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { Domain, EntityType, FTSQueryRecord, FTSResult } from 'app/interfaces';
import { LegendService } from 'app/shared/services/legend.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { GraphSearchService } from '../services/graph-search.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { tap } from 'rxjs/operators';
import { createSearchParamsFromQuery, getQueryParams } from '../utils/search';
import { GraphSearchParameters } from '../graph-search';
import { ModuleProperties } from '../../shared/modules';

@Component({
  selector: 'app-graph-search',
  templateUrl: './graph-search.component.html',
})
export class GraphSearchComponent implements OnInit, OnDestroy {
  @ViewChild('body', {static: false}) body: ElementRef;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  readonly loadTask: BackgroundTask<GraphSearchParameters, FTSResult> = new BackgroundTask(params => {
    return this.searchService.visualizerSearchTemp(
      params.query,
      params.organism,
      params.page,
      params.limit,
      this.createFilterQuery(params.domains, params.entityTypes),
    );
  });

  params: GraphSearchParameters | undefined;
  collectionSize = 0;
  results: FTSQueryRecord[] = [];

  legend: Map<string, string> = new Map();

  private valuesSubscription: Subscription;
  routerParamSubscription: Subscription;
  loadTaskSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private searchService: GraphSearchService,
    private legendService: LegendService,
    private workspaceManager: WorkspaceManager,
  ) {
  }

  ngOnInit() {
    this.valuesSubscription = this.loadTask.values$.subscribe(value => {
      this.modulePropertiesChange.emit({
        title: value.query != null && value.query.length ? `Visualizer: ${value.query}` : 'Visualizer',
        fontAwesomeIcon: 'search',
      });
    });

    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result}) => {
      const {nodes, total} = result;
      this.results = nodes;
      this.collectionSize = total;
      this.body.nativeElement.scrollTop = 0;
    });

    this.legendService.getAnnotationLegend().subscribe(legend => {
      Object.keys(legend).forEach(label => {
        // Keys of the result dict are all lowercase, need to change the first character
        // to uppercase to match Neo4j labels
        const formattedLabel = label.slice(0, 1).toUpperCase() + label.slice(1);
        this.legend.set(formattedLabel, legend[label].color);
      });
    });

    this.routerParamSubscription = this.route.queryParams.pipe(
      tap((params) => {
        if (params.q != null) {
          this.params = createSearchParamsFromQuery(params);
          this.loadTask.update(this.params);
        } else {
          this.params = null;
          this.results = [];
          this.collectionSize = 0;
        }
        if (this.body) {
          this.body.nativeElement.scrollTop = 0;
        }
      }),
    ).subscribe();
  }

  ngOnDestroy() {
    this.routerParamSubscription.unsubscribe();
    this.loadTaskSubscription.unsubscribe();
    this.valuesSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.params);
  }

  search(params: GraphSearchParameters) {
    this.workspaceManager.navigate(['/search'], {
      queryParams: {
        ...getQueryParams(params),
        t: new Date().getTime(), // Hack so if the person press search without changing anything, we still refresh
      },
    });
  }

  goToPage(page: number) {
    this.search({
      ...this.params,
      page,
    });
  }

  private createFilterQuery(domains?: Domain[], entityTypes?: EntityType[]): string {
    const conditions: string[] = [];

    if (domains && domains.length) {
      domains.map(value => conditions.push(value.name));
    }

    if (entityTypes && entityTypes.length) {
      entityTypes.map(value => conditions.push(value.name));
    }

    return conditions.join(', ');
  }
}
