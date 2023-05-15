import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { defer, Observable, of, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  flow as _flow,
  thru as _thru,
  sortBy as _sortBy,
  fromPairs as _fromPairs,
  map as _map,
  values as _values,
} from 'lodash/fp';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { EnrichmentVisualisationService, EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { mapIterable } from 'app/shared/utils';

import { EnrichmentService } from '../../services/enrichment.service';


@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [EnrichmentVisualisationService, EnrichmentService, ModuleContext]
})
export class EnrichmentVisualisationViewerComponent implements ModuleAwareComponent {

  constructor(protected readonly route: ActivatedRoute,
              readonly enrichmentService: EnrichmentVisualisationService,
              private readonly moduleContext: ModuleContext) {
    moduleContext.register(this);
  }

  currentContext: string;

  object$: Observable<FilesystemObject> = this.enrichmentService.object$;
  @Output() modulePropertiesChange = this.object$.pipe(
    map(object => ({
      title: object?.filename ?? 'Statistical Enrichment',
      fontAwesomeIcon: 'chart-bar',
    }))
  );

  loadTask: BackgroundTask<string, EnrichWithGOTermsResult[]> = new BackgroundTask(
    () => this.enrichmentService.enrichWithGOTerms('fisher')
  );
  readonly grouping = {
    'Biological Process': 'BiologicalProcess',
    'Molecular Function': 'MolecularFunction',
    'Cellular Component': 'CellularComponent'
  };
  data$ = this.loadTask.results$.pipe(
      map(
        _flow(
          _thru(({result}) => result),
          _sortBy<EnrichWithGOTermsResult>('p-value'),
          _thru(result =>
            _flow(
              _values,
              _map(goLabel => [goLabel, result.filter(({goLabel: labels}) => labels.includes(goLabel))]),
              _fromPairs
            )(this.grouping)
          )
        )
      )
  );
  contextIdx: number;


  sourceData$ = this.object$.pipe(
    map(object => object.getGraphEntitySources())
  );

  // preserve sort for keyvalue pipe
  originalOrder(a, b) {
    return 0;
  }
}
