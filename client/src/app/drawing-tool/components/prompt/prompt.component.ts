import { Component, Injector, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, combineLatest, defer, Observable, ReplaySubject, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  withLatestFrom,
} from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  DrawingToolPromptFormComponent,
  DrawingToolPromptFormParams,
} from 'app/playground/components/form/drawing-tool-prompt-form/drawing-tool-prompt-form.component';
import { OpenPlaygroundParams } from 'app/playground/components/open-playground/open-playground.component';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';
import { ExplainService } from 'app/shared/services/explain.service';
import {
  DropdownController,
  dropdownControllerFactory,
} from 'app/shared/utils/dropdown.controller.factory';
import { openModal } from 'app/shared/utils/modals';
import { PlaygroundComponent } from 'app/playground/components/playground.component';
import { ChatgptResponseInfoModalComponent } from 'app/shared/components/chatgpt-response-info-modal/chatgpt-response-info-modal.component';
import { ChatGPTResponse } from 'app/enrichment/services/enrichment-visualisation.service';
import { addStatus, PipeStatus } from 'app/shared/pipes/add-status.pipe';

@Component({
  selector: 'app-drawing-tool-prompt',
  templateUrl: './prompt.component.html',
})
export class DrawingToolPromptComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly explainService: ExplainService,
    private readonly openFileProvider: OpenFileProvider,
    private readonly injector: Injector,
    private readonly modalService: NgbModal
  ) {}

  private readonly destroy$: Subject<void> = new Subject();

  @Input() entities!: Iterable<string>;
  private readonly entitiesChange$ = new ReplaySubject<DrawingToolPromptComponent['entities']>(1);
  private readonly entities$: Observable<DrawingToolPromptComponent['entities']> = defer(() =>
    this.entitiesChange$.pipe(
      startWith(this.entities),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );

  readonly tempertaure$: Subject<number> = new BehaviorSubject(0);

  private readonly contexts$: Observable<FilesystemObject['contexts']> =
    this.openFileProvider.object$.pipe(
      map(({ contexts }) => contexts),
      startWith([]),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  readonly contextsController$: Observable<DropdownController<string>> = this.contexts$.pipe(
    map(dropdownControllerFactory),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly params$ = combineLatest([
    this.entities$,
    this.tempertaure$.pipe(distinctUntilChanged()),
    this.contextsController$.pipe(switchMap((controller) => controller.current$)),
  ]).pipe(
    takeUntil(this.destroy$),
    map(([entities, temperature, context]) => ({ entities, temperature, context })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * This subject is used to trigger the explanation generation and its value changes output visibility.
   */
  readonly explain$ = new ReplaySubject<boolean>(1);

  readonly explanation$: Observable<PipeStatus<ChatGPTResponse>> = this.explain$.pipe(
    withLatestFrom(this.params$),
    map(([_, params]) => params),
    takeUntil(this.destroy$),
    switchMap(({ entities, temperature, context }) =>
      this.explainService.relationship(entities, context, { temperature }).pipe(addStatus())
    )
  );

  readonly playgroundParams$: Observable<OpenPlaygroundParams<DrawingToolPromptFormParams>> =
    combineLatest([this.params$, this.contexts$]).pipe(
      map(([{ temperature, entities, context }, contexts]) => ({
        promptFormParams: {
          formInput: {
            entities: Array.from(entities),
            context,
          },
          contexts,
        },
        promptForm: DrawingToolPromptFormComponent,
        temperature,
      }))
    );

  generateExplanation() {
    this.explain$.next(true);
  }

  public ngOnChanges({ entities }: SimpleChanges) {
    if (entities) {
      this.entitiesChange$.next(entities.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openPlayground() {
    const playground = openModal(this.modalService, PlaygroundComponent, {
      injector: this.injector,
      size: 'xl',
    });
    const paramsSubscription = this.params$.subscribe((params) => {
      Object.assign(playground.componentInstance, params);
      playground.componentInstance.cdr.detectChanges();
    });
    return playground.result.finally(() => {
      paramsSubscription.unsubscribe();
    });
  }

  openInfo(queryParams: object) {
    const info = this.modalService.open(ChatgptResponseInfoModalComponent);
    info.componentInstance.queryParams = queryParams;
    return info.result;
  }
}
