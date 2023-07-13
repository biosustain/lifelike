import { Component } from '@angular/core';

import {
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  throttle,
} from 'rxjs/operators';
import {
  filter as _filter,
  flatMap as _flatMap,
  flow as _flow,
  map as _map,
  uniq as _uniq,
} from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { isEqual } from 'lodash-es';

import {
  EnrichmentVisualisationService,
  EnrichWithGOTermsResult,
} from 'app/enrichment/services/enrichment-visualisation.service';
import {
  DropdownController,
  dropdownControllerFactory,
} from 'app/shared/utils/dropdown.controller.factory';
import { idle } from 'app/shared/rxjs/idle-observable';
import { EnrichmentVisualisationSelectService } from 'app/enrichment/services/enrichment-visualisation-select.service';

@Component({
  selector: 'app-enrichment-explanation-panel',
  templateUrl: './explanation-panel.component.html',
})
export class EnrichmentVisualisationExplanationPanelComponent {
  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly enrichmentVisualisationSelectService: EnrichmentVisualisationSelectService
  ) {}

  contextsController$: Observable<DropdownController<string>> =
    this.enrichmentService.contexts$.pipe(
      map(dropdownControllerFactory),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  goTermController$: Observable<DropdownController<string>> =
    this.enrichmentService.enrichedWithGOTerms$.pipe(
      map(
        _flow(
          _map(({ goTerm }) => goTerm),
          _uniq
        )
      ),
      map((entities) => {
        const controller = dropdownControllerFactory(entities);
        this.enrichmentVisualisationSelectService.goTerm$
          .pipe(map((goTerm) => entities.indexOf(goTerm)))
          .subscribe(controller.currentIdx$);
        return controller;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  geneNameController$: Observable<DropdownController<string>> =
    this.enrichmentService.enrichedWithGOTerms$.pipe(
      switchMap((entities) =>
        this.goTermController$.pipe(
          switchMap((goTermController) => goTermController.current$),
          map((goTerm) =>
            _flow(
              _filter(goTerm ? (r: EnrichWithGOTermsResult) => r.goTerm === goTerm : () => true),
              _flatMap('geneNames'),
              _uniq
            )(entities)
          )
        )
      ),
      map((entities) => {
        const controller = dropdownControllerFactory(entities);
        this.enrichmentVisualisationSelectService.geneName$
          .pipe(map((geneName) => entities.indexOf(geneName)))
          .subscribe(controller.currentIdx$);
        return controller;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  explanation$: Observable<string> = combineLatest([
    this.contextsController$.pipe(
      switchMap(({ current$ }) => current$),
      startWith(undefined)
    ),
    this.goTermController$.pipe(
      switchMap(({ current$ }) => current$),
      startWith(undefined)
    ),
    this.geneNameController$.pipe(
      switchMap(({ current$ }) => current$),
      startWith(undefined)
    ),
  ]).pipe(
    throttle(() => idle(), { leading: true, trailing: true }),
    distinctUntilChanged(isEqual),
    switchMap(([context, goTerm, geneName]) =>
      this.enrichmentService
        .enrichTermWithContext(goTerm, context, geneName)
        .pipe(startWith('Loading...'))
    )
  );
}
