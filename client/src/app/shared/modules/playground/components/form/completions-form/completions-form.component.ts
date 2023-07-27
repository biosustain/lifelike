import { HttpErrorResponse } from '@angular/common/http';
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
import { BehaviorSubject, defer, EMPTY, Observable, ReplaySubject } from 'rxjs';
import { catchError, finalize, map, shareReplay, startWith, tap } from 'rxjs/operators';

import { ChatGPTModel } from '../../../../../services/explain.service';
import * as CustomValidators from '../../../../../utils/form/validators';
import { FormArrayWithFactory, FormGroupWithFactory } from '../../../../../utils/form/with-factory';
import { ChatGPT, CompletitionsParams } from '../../../ChatGPT';
import { WrappedRequest } from '../../../interfaces';
import { PlaygroundService } from '../../../services/playground.service';
import { CompletionForm } from '../interfaces';

@Component({
  selector: 'app-completions-form',
  templateUrl: './completions-form.component.html',
})
export class CompletionsFormComponent implements OnChanges, CompletionForm {
  constructor(private readonly playgroundService: PlaygroundService) {}

  models$: Observable<string[]> = this.playgroundService
    .completionsModels()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  groupedModels$: Observable<Record<string, string[]>> = this.models$.pipe(
    map(_flow(_groupBy(ChatGPT.getModelGroup), _mapValues(_sortBy(_identity)))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  form = new FormGroup({
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
  modelControl = this.form.controls.model as FormControl;
  stopControl = this.form.controls.stop as FormArrayWithFactory<FormControl, string>;
  logitBiasControl = this.form.controls.logitBias as FormGroupWithFactory<FormControl, string>;

  estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map((params: CompletitionsParams) =>
        ChatGPT.estimateCost(params.model, ChatGPT.completions.estimateRequestTokens(params))
      )
    )
  );
  requestParams$ = new ReplaySubject<CompletitionsParams>(1);

  @Input() temperature!: number;
  @Input() prompt!: string;
  @Output() request: Observable<WrappedRequest<CompletitionsParams, any>> =
    this.requestParams$.pipe(
      map((params) => {
        const loading$ = new BehaviorSubject(true);
        const error$ = new ReplaySubject<HttpErrorResponse>(1);
        const result$: Observable<any> = this.playgroundService.completionsCreate(params).pipe(
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

        if (params.stream) {
          return {
            params,
            loading$,
            error$,
            result$,
            cost$: new BehaviorSubject(NaN),
            cached$: new BehaviorSubject(false),
          } as WrappedRequest<CompletitionsParams, any>;
        } else {
          return {
            params,
            loading$,
            error$,
            result$: result$.pipe(map(({ result }) => result)),
            cost$: result$.pipe(
              map(
                ({ result }) =>
                  ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens
              )
            ),
            cached$: result$.pipe(map(({ cached }) => cached)),
          } as WrappedRequest<CompletitionsParams, any>;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  ngOnChanges({ temperature, prompt }: SimpleChanges) {
    if (temperature) {
      this.form.controls.temperature.reset(temperature.currentValue);
    }
    if (prompt) {
      this.form.controls.prompt.reset(prompt.currentValue);
    }
  }

  private parseFormValueToParams = (formValue): CompletitionsParams =>
    _omit([
      _isEmpty(formValue.stop) ? 'stop' : null,
      _isEmpty(formValue.logitBias) ? 'logitBias' : null,
      formValue.n === 1 ? 'n' : null,
    ])(formValue) as CompletitionsParams;

  onSubmit() {
    this.requestParams$.next(this.parseFormValueToParams(this.form.value));
  }

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }
}
