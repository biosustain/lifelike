import { Component, Injector } from '@angular/core';

import {
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  throttle,
  withLatestFrom,
} from 'rxjs/operators';
import {
  filter as _filter,
  flatMap as _flatMap,
  flow as _flow,
  map as _map,
  uniq as _uniq,
} from 'lodash/fp';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { isEqual } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

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
import {
  EnrichmentPromptFormComponent,
  EnrichmentPromptFormParams,
} from 'app/playground/components/form/enrichment-prompt-form/enrichment-prompt-form.component';
import { OpenPlaygroundParams } from 'app/playground/components/open-playground/open-playground.component';

@Component({
  selector: 'app-enrichment-explanation-panel',
  templateUrl: './explanation-panel.component.html',
})
export class EnrichmentVisualisationExplanationPanelComponent {
  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly enrichmentVisualisationSelectService: EnrichmentVisualisationSelectService,
    readonly injector: Injector,
    readonly modalService: NgbModal
  ) {}

  contextsController$: Observable<DropdownController<string>> =
    this.enrichmentService.contexts$.pipe(
      map(dropdownControllerFactory),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  goTerms$: Observable<string[]> = this.enrichmentService.enrichedWithGOTerms$.pipe(
    map(
      _flow(
        _map(({ goTerm }) => goTerm),
        _uniq
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  goTermController$: Observable<DropdownController<string>> = this.goTerms$.pipe(
    map((entities) => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.goTerm$
        .pipe(map((goTerm) => entities.indexOf(goTerm)))
        .subscribe(controller.currentIdx$);
      return controller;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  geneNames$: Observable<string[]> = this.enrichmentService.enrichedWithGOTerms$.pipe(
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
    shareReplay({ bufferSize: 1, refCount: true })
  );

  geneNameController$: Observable<DropdownController<string>> = this.geneNames$.pipe(
    map((entities) => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.geneName$
        .pipe(map((geneName) => entities.indexOf(geneName)))
        .subscribe(controller.currentIdx$);
      return controller;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  params$ = combineLatest([
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
    map(([context, goTerm, geneName]) => ({
      context,
      goTerm,
      geneName,
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  playgroundParams$: Observable<OpenPlaygroundParams<EnrichmentPromptFormParams>> = combineLatest([
    combineLatest(this.params$, this.enrichmentService.enrichmentDocument$).pipe(
      map(([params, { organism }]) => ({
        ...params,
        organism,
      }))
    ),
    this.enrichmentService.contexts$,
    this.geneNames$,
    this.goTerms$,
  ]).pipe(
    map(([formInput, contexts, geneNames, goTerms]) => ({
      formInput,
      contexts,
      geneNames,
      goTerms,
    })),
    map((promptFormParams: EnrichmentPromptFormParams) => ({
      promptFormParams,
      promptForm: EnrichmentPromptFormComponent,
    }))
  );

  /**
   * This subject is used to trigger the explanation generation and its value changes output visibility.
   */
  explain$ = new ReplaySubject<boolean>(1);

  explanation$: Observable<string> = this.explain$.pipe(
    withLatestFrom(
      combineLatest([
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
      ])
    ),
    map(([, [context, goTerm, geneName]]) => [context, goTerm, geneName]),
    throttle(() => idle(), { leading: true, trailing: true }),
    distinctUntilChanged(isEqual),
    switchMap(([context, goTerm, geneName]) =>
      this.enrichmentService.enrichTermWithContext(goTerm, context, geneName).pipe(startWith(null))
    )
  );

  generateExplanation() {
    this.explain$.next(true);
  }
}
