import { ComponentType } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
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
  flow as _flow,
  groupBy as _groupBy,
  identity as _identity,
  isEmpty as _isEmpty,
  keyBy as _keyBy,
  mapValues as _mapValues,
  mergeWith as _mergeWith,
  omit as _omit,
  sortBy as _sortBy,
  values as _values,
} from 'lodash/fp';
import {
  BehaviorSubject,
  defer,
  EMPTY,
  from,
  iif,
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
import * as CustomValidators from 'app/shared/utils/form/custom-validators';
import { FormArrayWithFactory, FormGroupWithFactory } from 'app/shared/utils/forms/with-factory';
import { debug } from 'app/shared/rxjs/debug';

import { ChatGPT, CompletitionsParams } from '../ChatGPT';
import { PromptComposer } from '../interface';

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
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
  ) {
    this.promptComposer$
      .pipe(switchMap(({ componentRef }) => componentRef.instance.prompt$))
      .subscribe((prompt) => {
        this.form.controls.prompt.setValue(prompt);
      });
  }

  @ViewChild('promptForm', { static: true, read: ViewContainerRef })
  promptFormView: ViewContainerRef;
  @Input() promptForm: ComponentType<PromptComposer>;
  @Input() promptFormParams: Record<string, any>;
  promptFormParams$ = new ReplaySubject<Record<string, any>>(1);
  @Input() temperature: number;

  private destroy$: Subject<void> = new Subject();
  private readonly promptComposers: Map<PromptComposer, DynamicComponentRef<PromptComposer>> =
    new Map();
  private readonly promptComposer$ = new ReplaySubject<DynamicComponentRef<PromptComposer>>(1);

  readonly requestParams$ = new ReplaySubject<CompletitionsParams>(1);

  readonly request$ = this.requestParams$.pipe(
    map((params) => {
      const loading$ = new BehaviorSubject(true);
      const error$ = new ReplaySubject<HttpErrorResponse>(1);
      const result$: Observable<any> = this.explainService.playground(params).pipe(
        tap(() => loading$.next(false)),
        catchError((error) => {
          error$.next(error);
          return EMPTY;
        }),
        finalize(() => {
          loading$.complete();
          error$.complete();
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

      return {
        params,
        loading$,
        error$,
        result$,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly result$ = this.request$.pipe(
    switchMap(({ result$, params }) =>
      iif(
        () => params.stream,
        result$.pipe(
          tap((result) => console.log(result)),
          filter(({ partialText }) => Boolean(partialText)),
          mergeMap(({ partialText }) =>
            from(partialText.split('\n').filter(_identity)).pipe(
              map((partialTextLine: string) => JSON.parse(partialTextLine)),
              scan((acc, partial) =>
                _mergeWith((a, b, key, obj) =>
                  key === 'choices'
                    ? _values(
                        _mergeWith((ca, cb, ckey) =>
                          ckey === 'text' ? `${ca ?? ''}${cb ?? ''}` : undefined
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

  readonly requestCost$ = this.result$.pipe(
    withLatestFrom(this.requestParams$),
    map(
      ([{ result }, params]) =>
        ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens
    )
  );

  readonly models$: Observable<string[]> = this.chatGPT.models$;

  readonly form = new FormGroup({
    timeout: new FormControl(60),
    model: new FormControl(
      'text-davinci-003',
      [Validators.required],
      [
        (control: AbstractControl) =>
          this.models$.pipe(
            map((models) =>
              models.includes(control.value) ? null : { notAvailable: control.value }
            )
          ),
      ]
    ),
    prompt: new FormControl('', [Validators.required]),
    maxTokens: new FormControl(200),
    temperature: new FormControl(0, [Validators.min(0), Validators.max(2)]),
    topP: new FormControl(1),
    n: new FormControl(1, [
      CustomValidators.isInteger,
      ({ value }: FormControl) => {
        const bestOf = this.form?.controls.bestOf?.value;
        if (!bestOf) {
          return null;
        }
        return value < bestOf ? { nSmallerThanBestOf: { value, bestOf } } : null;
      },
    ]),
    stream: new FormControl(false, [CustomValidators.isBoolean]),
    logprobs: new FormControl(0, [Validators.max(5), CustomValidators.isInteger]),
    echo: new FormControl(false, [CustomValidators.isBoolean]),
    stop: new FormArrayWithFactory(() => new FormControl(null, [Validators.required]), null, [
      Validators.maxLength(4),
    ]),
    presencePenalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    frequencyPenalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    bestOf: new FormControl(1, [CustomValidators.isInteger]),
    logitBias: new FormGroupWithFactory(
      () => new FormControl(0, [Validators.min(-100), Validators.max(100)]),
      {}
    ),
  });
  // region Typed form controls to use in template
  readonly logitBiasControl = this.form.controls.logitBias as FormGroupWithFactory;
  readonly stopControl = this.form.controls.stop as FormArrayWithFactory;
  // endregion

  readonly estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(startWith(this.form.value), map(ChatGPT.estimateCost))
  );

  readonly groupedModels$: Observable<Record<string, string[]>> = this.models$.pipe(
    map(_flow(_groupBy(ChatGPT.getModelGroup), _mapValues(_sortBy(_identity)))),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly cached$ = this.result$.pipe(map(({ cached }) => cached));

  readonly resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result.result ?? result, null, 2)),
    catchError((error) => of(`Error: ${error}`)),
    takeUntil(this.destroy$)
  );

  readonly resultChoices$ = this.result$.pipe(
    map(({ result }) => result?.choices ?? []),
    catchError((error) => of(`Error: ${error}`))
  );

  ngOnChanges({ temparature, promptForm, promptFormParams }: SimpleChanges): void {
    if (temparature) {
      this.form.controls.temperature.reset(temparature.currentValue);
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

  private parseFormValueToParams = (formValue): CompletitionsParams =>
    _omit([
      _isEmpty(formValue.stop) ? 'stop' : null,
      _isEmpty(formValue.logitBias) ? 'logitBias' : null,
      formValue.n === 1 ? 'n' : null,
    ])(formValue) as CompletitionsParams;

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }

  trackByIndex = ({ index }) => index;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmitRequest() {
    this.requestParams$.next(this.parseFormValueToParams(this.form.value));
  }

  close() {
    this.modal.close();
  }
}
