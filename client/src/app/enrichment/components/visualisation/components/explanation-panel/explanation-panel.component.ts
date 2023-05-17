import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import {
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import {
  filter as _filter,
  flatMap as _flatMap,
  flow as _flow,
  has as _has,
  isEmpty,
  map as _map,
  uniq as _uniq,
} from 'lodash/fp';
import { BehaviorSubject, defer, EMPTY, Observable, Subject } from 'rxjs';

import {
  EnrichmentVisualisationService,
  EnrichWithGOTermsResult,
} from 'app/enrichment/services/enrichment-visualisation.service';
import { EnrichmentVisualisationSelectService } from '../../../../services/enrichment-visualisation-select.service';

interface DropdownController<T> {
  entities: ReadonlyArray<T>;
  currentIdx$?: BehaviorSubject<number>;
  current$: Observable<T>;
}

const dropdownControllerFactory = <T>(entities: T[]): DropdownController<T> => {
  if (isEmpty(entities)) {
    return {
      entities: [],
      currentIdx$: new BehaviorSubject(-1),
      current$: EMPTY,
    };
  }
  const currentIdx$ = new BehaviorSubject(0);
  return ({
    entities,
    currentIdx$,
    current$: currentIdx$.pipe(
      map(idx => entities[idx]),
    ),
  });
};

@Component({
  selector: 'app-enrichment-explanation-panel',
  templateUrl: './explanation-panel.component.html',
})
export class EnrichmentVisualisationExplanationPanelComponent {
  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly enrichmentVisualisationSelectService: EnrichmentVisualisationSelectService
  ) {
  }

  contextsController$: Observable<DropdownController<string>> = this.enrichmentService.contexts$.pipe(
    map(dropdownControllerFactory),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  goTermController$: Observable<DropdownController<string>> = this.enrichmentService.enrichedWithGOTerms$.pipe(
    map(_flow(
      _map(({goTerm}) => goTerm),
      _uniq,
    )),
    map(entities => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.goTerm$.pipe(
        map(goTerm => entities.indexOf(goTerm)),
      ).subscribe(controller.currentIdx$);
      return controller;
    }),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  geneNameController$: Observable<DropdownController<string>> = this.enrichmentService.enrichedWithGOTerms$.pipe(
    switchMap(entities => this.goTermController$.pipe(
        switchMap(goTermController => goTermController.current$),
        map(goTerm => _flow(
            _filter((r: EnrichWithGOTermsResult) => r.goTerm === goTerm),
            _flatMap('geneNames'),
            _uniq,
          )(entities),
        ),
      ),
    ),
    map(entities => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.geneName$.pipe(
        map(geneName => entities.indexOf(geneName)),
      ).subscribe(controller.currentIdx$);
      return controller;
    }),
    shareReplay({bufferSize: 1, refCount: true}),
  );
}
