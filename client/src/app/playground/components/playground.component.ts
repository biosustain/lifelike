import { ComponentType } from '@angular/cdk/overlay';
import { HttpDownloadProgressEvent } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  first as _first,
  identity as _identity,
  keyBy as _keyBy,
  mergeWith as _mergeWith,
  values as _values,
  flow as _flow,
  groupBy as _groupBy,
  isEmpty as _isEmpty,
  mapValues as _mapValues,
  omit as _omit,
  sortBy as _sortBy,
} from 'lodash/fp';
import {
  BehaviorSubject,
  ConnectableObservable,
  from,
  iif,
  merge,
  defer,
  EMPTY,
  Observable,
  of,
  ReplaySubject,
  Subject,
} from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  map,
  mergeMap,
  scan,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { DynamicComponentRef, DynamicViewService } from 'app/shared/services/dynamic-view.service';
import { ExplainService } from 'app/shared/services/explain.service';
import { debug } from 'app/shared/rxjs/debug';

import { ChatCompletionsFormComponent } from '../modules/chat-completions-form/chat-completions-form.component';
import { CompletionsFormComponent } from '../modules/completions-form/completions-form.component';
import { CompletionForm } from '../interfaces/form';
import { ChatGPT } from '../services/ChatGPT';
import { PromptComposer } from '../interfaces/prompt';

interface Result {
  choices: any[];
}

interface ModeRef {
  label: string;
  form: ComponentType<CompletionForm>;
  componentRef?: ComponentRef<CompletionForm>;
}

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
  entryComponents: [CompletionsFormComponent, ChatCompletionsFormComponent],
  providers: [ChatGPT],
})
export class PlaygroundComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly explainService: ExplainService,
    private readonly modal: NgbActiveModal,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly dynamicViewService: DynamicViewService,
    public readonly cdr: ChangeDetectorRef,
    private readonly chatGPT: ChatGPT
  ) {}

  @ViewChild('promptForm', { static: true, read: ViewContainerRef })
  promptFormView: ViewContainerRef;
  @Input() promptForm: ComponentType<PromptComposer>;
  @Input() promptFormParams: Record<string, any>;
  readonly promptFormParams$ = new ReplaySubject<Record<string, any>>(1);
  @ViewChild('modeForm', { static: true, read: ViewContainerRef }) modeFormView: ViewContainerRef;
  @Input() temperature: number;

  private readonly temperature$ = new ReplaySubject<number>(1);

  private readonly destroy$: Subject<void> = new Subject();
  private readonly promptComposers: Map<PromptComposer, DynamicComponentRef<PromptComposer>> =
    new Map();
  private readonly promptComposer$ = new ReplaySubject<DynamicComponentRef<PromptComposer>>(1);
  readonly prompt$: Observable<string> = this.promptComposer$.pipe(
    switchMap(({ componentRef }) => componentRef.instance.prompt$)
  );
  readonly params$: Observable<CompletionForm['params']> = merge(
    this.prompt$.pipe(map((prompt) => ({ prompt }))),
    this.temperature$.pipe(map((temperature) => ({ temperature })))
  );
  MODES: ModeRef[] = [
    { label: 'Chat', form: ChatCompletionsFormComponent },
    { label: 'Completion', form: CompletionsFormComponent },
  ];
  readonly modeChange$: BehaviorSubject<ModeRef> = new BehaviorSubject<ModeRef>(_first(this.MODES));
  readonly mode$ = this.modeChange$.pipe(
    scan((prev, next) => {
      if (prev) {
        this.dynamicViewService.detach(this.modeFormView, prev.componentRef);
      }
      if (next.componentRef) {
        // Reattach existing component
        this.dynamicViewService.insert(this.modeFormView, next.componentRef);
      } else {
        // Create new component
        next.componentRef = this.dynamicViewService.createComponent(
          this.modeFormView,
          next.form,
          this.params$.pipe(map((params) => ({ params })))
        );
      }
      return next;
    }, null)
  ) as ConnectableObservable<ModeRef>;
  readonly request$ = this.mode$.pipe(
    switchMap(({ componentRef }) => componentRef.instance.request)
  );
  readonly result$ = this.request$.pipe(
    switchMap(({ result$, params }) =>
      iif(
        () => params.stream,
        (result$ as Observable<HttpDownloadProgressEvent>).pipe(
          filter(({ partialText }) => Boolean(partialText)),
          mergeMap(({ partialText }) =>
            from(partialText.split('\n').filter(_identity)).pipe(
              map((partialTextLine: string) => JSON.parse(partialTextLine) as Partial<Result>),
              scan((acc, partial) =>
                _mergeWith((a, b, key, obj) =>
                  key === 'choices'
                    ? _values(
                        _mergeWith((ca, cb, ckey) =>
                          ckey in ['text', 'content'] ? `${ca ?? ''}${cb ?? ''}` : undefined
                        )(_keyBy('index')(a), _keyBy('index')(b))
                      )
                    : undefined
                )(acc, partial)
              )
            )
          ),
          tap((result) => console.log(result)),
          map((result) => ({ result, cached: false }))
        ),
        result$
      )
    ),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly cached$ = this.request$.pipe(
    switchMap(({ cached$ }) => cached$),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly requestCost$ = this.request$.pipe(
    switchMap(({ cost$ }) => cost$),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result, null, 2)),
    catchError((error) => of(`Error: ${error}`)),
    takeUntil(this.destroy$)
  );
  readonly resultChoices$ = this.result$.pipe(
    map((result) => result?.choices ?? []),
    catchError((error) => of(`Error: ${error}`))
  );

  ngOnChanges({ temparature, promptForm, promptFormParams }: SimpleChanges): void {
    if (temparature) {
      this.temperature$.next(temparature.currentValue);
    }
    if (promptForm) {
      const prev = this.promptComposers.get(promptForm.previousValue);
      if (prev) {
        this.dynamicViewService.detach(this.promptFormView, prev.componentRef);
      }
      const next = this.promptComposers.get(promptForm.currentValue);
      if (next?.componentRef) {
        // Reattach existing component
        this.dynamicViewService.insert(this.promptFormView, next.componentRef);
      } else {
        // Create new component
        const promptComposer = {
          componentRef: this.dynamicViewService.createComponent<PromptComposer>(
            this.promptFormView,
            promptForm.currentValue,
            this.promptFormParams$.pipe(debug('promptFormParams'))
          ),
        };
        this.promptComposers.set(promptForm.currentValue, promptComposer);
        this.promptComposer$.next(promptComposer);
      }
    }
    if (promptFormParams) {
      console.log('promptFormParams$ update');
      this.promptFormParams$.next(promptFormParams.currentValue);
    }
  }

  trackByIndex = ({ index }) => index;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.modal.close();
  }
}
