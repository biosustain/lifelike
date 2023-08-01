import { Component, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import {
  flow as _flow,
  groupBy as _groupBy,
  identity as _identity,
  isEmpty as _isEmpty,
  map as _map,
  mapValues as _mapValues,
  omit as _omit,
  sortBy as _sortBy,
} from 'lodash/fp';
import { BehaviorSubject, defer, Observable, ReplaySubject } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';

import { ChatGPTModel } from '../../../../shared/services/explain.service';
import * as CustomValidators from '../../../../shared/utils/forms/validators';
import {
  FormArrayWithFactory,
  FormGroupWithFactory,
} from '../../../../shared/utils/forms/with-factory';
import { ChatGPT, CompletitionsOptions } from '../../../ChatGPT';
import { PlaygroundService } from '../../../services/playground.service';
import { CompletionForm, CompletionFormProjectedParams } from '../interfaces';
import { toRequest } from '../../../utils';

@Component({
  selector: 'app-completions-form',
  templateUrl: './completions-form.component.html',
})
export class CompletionsFormComponent implements OnChanges, CompletionForm<CompletitionsOptions> {
  constructor(private readonly playgroundService: PlaygroundService) {}

  models$: Observable<string[]> = this.playgroundService
    .completionsModels()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  protected readonly form = new FormGroup({
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

  protected readonly estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map((params: CompletitionsOptions) =>
        ChatGPT.estimateCost(params.model, ChatGPT.completions.estimateRequestTokens(params))
      )
    )
  );
  requestParams$ = new ReplaySubject<CompletitionsOptions>(1);

  @Input() params: CompletionFormProjectedParams;
  @Output() request = this.requestParams$.pipe(
    map((params) => [params]),
    toRequest((params) => this.playgroundService.completionsCreate(params)),
    map(({ arguments: [params], result$, ...rest }) => {
      if (params.stream) {
        return {
          ...rest,
          params,
          result$,
          cost$: new BehaviorSubject(NaN),
          cached$: new BehaviorSubject(false),
        };
      } else {
        return {
          ...rest,
          params,
          result$: result$.pipe(map(({ result }) => result)),
          cost$: result$.pipe(
            map(
              ({ result }) => ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens
            )
          ),
          cached$: result$.pipe(map(({ cached }) => cached)),
        };
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnChanges({ params }: SimpleChanges) {
    if (params?.currentValue) {
      this.form.patchValue(params.currentValue, { emitEvent: false });
    }
  }

  private parseFormValueToParams = (formValue): CompletitionsOptions =>
    _omit([
      _isEmpty(formValue.stop) ? 'stop' : null,
      _isEmpty(formValue.logitBias) ? 'logitBias' : null,
      formValue.n === 1 ? 'n' : null,
    ])(formValue) as CompletitionsOptions;

  onSubmit() {
    this.requestParams$.next(this.parseFormValueToParams(this.form.value));
  }

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }
}
