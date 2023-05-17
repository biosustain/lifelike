import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  BehaviorSubject,
  defer,
  EMPTY,
  Observable,
  of,
  ReplaySubject, Subject,
  Subscription,
  throwError,
} from 'rxjs';
import { map, shareReplay, switchMap, take } from 'rxjs/operators';
import {
  flow as _flow,
  thru as _thru,
  sortBy as _sortBy,
  fromPairs as _fromPairs,
  toPairs as _toPairs,
  map as _map,
  values as _values,
} from 'lodash/fp';
import { isEmpty } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { EnrichmentVisualisationService, EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';
import { ModuleContext } from 'app/shared/services/module-context.service';

import { EnrichmentService } from '../../services/enrichment.service';
import { EnrichmentVisualisationSelectService } from '../../services/enrichment-visualisation-select.service';



@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [EnrichmentVisualisationService, EnrichmentService, ModuleContext, EnrichmentVisualisationSelectService]
})
export class EnrichmentVisualisationViewerComponent implements ModuleAwareComponent {

  constructor(
    protected readonly route: ActivatedRoute,
    readonly enrichmentService: EnrichmentVisualisationService,
    private readonly moduleContext: ModuleContext
  ) {
    moduleContext.register(this);
  }



  object$: Observable<FilesystemObject> = this.enrichmentService.object$;
  @Output() modulePropertiesChange = this.object$.pipe(
    map(object => ({
      title: object?.filename ?? 'Statistical Enrichment',
      fontAwesomeIcon: 'chart-bar',
    }))
  );

  readonly grouping = {
    'Biological Process': 'BiologicalProcess',
    'Molecular Function': 'MolecularFunction',
    'Cellular Component': 'CellularComponent'
  };

  data$ = this.enrichmentService.enrichedWithGOTerms$.pipe(
    map(
      _flow(
        _sortBy<EnrichWithGOTermsResult>('p-value'),
        _thru(result =>
          _flow(
            _toPairs,
            _map(([group, goLabel]) => [group, result.filter(({goLabel: labels}) => labels.includes(goLabel))]),
            _fromPairs,
          )(this.grouping),
        ),
      ),
    ),
    shareReplay({bufferSize: 1, refCount: true})
  );

  sourceData$ = this.object$.pipe(
    map(object => object.getGraphEntitySources())
  );

  // preserve sort for keyvalue pipe
  originalOrder(a, b) {
    return 0;
  }
}
