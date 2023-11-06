import { Component, Injector } from '@angular/core';

import {
  filter as _filter,
  flatMap as _flatMap,
  flow as _flow,
  map as _map,
  uniq as _uniq,
} from 'lodash/fp';
import {
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  throttle,
  withLatestFrom,
} from 'rxjs/operators';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { isEqual } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { idle } from 'app/shared/rxjs/idle-observable';
import {
  DropdownController,
  dropdownControllerFactory,
} from 'app/shared/utils/dropdown.controller.factory';
import { EnrichmentVisualisationSelectService } from 'app/enrichment-visualisation/services/enrichment-visualisation-select.service';
import {
  EnrichmentPromptFormComponent,
  EnrichmentPromptFormParams,
} from 'app/enrichment-visualisation/modules/enrichment-prompt-form/enrichment-prompt-form.component';
import { OpenPlaygroundParams } from 'app/playground/components/open-playground/open-playground.component';
import { ChatgptResponseInfoModalComponent } from 'app/shared/components/chatgpt-response-info-modal/chatgpt-response-info-modal.component';
import {
  ChatGPTResponse,
  EnrichmentVisualisationService,
  EnrichWithGOTermsResult,
} from 'app/enrichment-visualisation/services/enrichment-visualisation.service';
import { addStatus, PipeStatus } from 'app/shared/modules/utils/pipes/add-status.pipe';
import { ClipboardService } from 'app/shared/services/clipboard.service';

@Component({
  selector: 'app-enrichment-explanation-panel',
  templateUrl: './explanation-panel.component.html',
})
export class EnrichmentVisualisationExplanationPanelComponent {
  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly enrichmentVisualisationSelectService: EnrichmentVisualisationSelectService,
    readonly injector: Injector,
    readonly modalService: NgbModal,
    private readonly clipboard: ClipboardService
  ) {}

  readonly contextsController$: Observable<DropdownController<string>> =
    this.enrichmentService.contexts$.pipe(
      map((entities) => dropdownControllerFactory(entities)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  readonly goTerms$: Observable<string[]> = this.enrichmentService.enrichedWithGOTerms$.pipe(
    map(
      _flow(
        _map(({ goTerm }) => goTerm),
        _uniq
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly goTermController$: Observable<DropdownController<string>> = this.goTerms$.pipe(
    map((entities) => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.goTerm$.subscribe(controller.select);
      return controller;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly geneNames$: Observable<string[]> = this.enrichmentService.enrichedWithGOTerms$.pipe(
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

  readonly geneNameController$: Observable<DropdownController<string>> = this.geneNames$.pipe(
    map((entities) => {
      const controller = dropdownControllerFactory(entities);
      this.enrichmentVisualisationSelectService.geneName$.subscribe(controller.select);
      return controller;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly params$ = combineLatest([
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

  readonly playgroundParams$: Observable<OpenPlaygroundParams<EnrichmentPromptFormParams>> =
    combineLatest([
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
  readonly explain$ = new ReplaySubject<boolean>(1);

  readonly explanation$: Observable<PipeStatus<ChatGPTResponse>> = this.explain$.pipe(
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
      this.enrichmentService.enrichTermWithContext(goTerm, context, geneName).pipe(addStatus())
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  generateExplanation() {
    this.explain$.next(true);
  }

  openInfo(queryParams: object) {
    const info = this.modalService.open(ChatgptResponseInfoModalComponent);
    info.componentInstance.queryParams = queryParams;
    return info.result;
  }

  copyToClipboard(text: string) {
    return this.clipboard.copy(text);
  }
}
