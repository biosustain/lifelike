import { Component, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { isEmpty as _isEmpty, map as _map, omitBy as _omitBy } from 'lodash/fp';
import { BehaviorSubject, defer, Observable, ReplaySubject } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';

import { ChatGPTModel } from 'app/shared/services/explain.service';
import * as CustomValidators from 'app/shared/utils/forms/validators';
import { FormArrayWithFactory, FormGroupWithFactory } from 'app/shared/utils/forms/with-factory';
import { omitByDeep } from 'app/shared/utils';

import { ChatCompletionOptions, ChatGPT } from '../../../ChatGPT';
import { ChatCompletionsResponse, PlaygroundService } from '../../../services/playground.service';
import { toRequest } from '../../../utils';
import { CompletionForm, CompletionFormProjectedParams } from '../interfaces';

@Component({
  selector: 'app-chat-completions-form',
  templateUrl: './chat-completions-form.component.html',
})
export class ChatCompletionsFormComponent
  implements OnChanges, CompletionForm<ChatCompletionOptions>
{
  constructor(private readonly playgroundService: PlaygroundService) {}

  readonly models$: Observable<string[]> = this.playgroundService
    .chatCompletionsModels()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  readonly ROLES = ['system', 'user', 'assistant', 'function'];

  readonly form = new FormGroup({
    timeout: new FormControl(60),
    model: new FormControl(
      'gpt-3.5-turbo',
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
    messages: new FormArrayWithFactory(
      () =>
        new FormGroup({
          role: new FormControl(null, [CustomValidators.oneOf(this.ROLES)]),
          content: new FormControl(null, [Validators.required]),
          name: new FormControl(null),
          functionCall: new FormGroupWithFactory(() => new FormControl(null)),
        }),
      [{ role: null, content: null, name: null, functionCall: {} }],
      [Validators.minLength(1)]
    ),
    functions: new FormArrayWithFactory(
      () =>
        new FormGroup({
          name: new FormControl(null, [Validators.required]),
          description: new FormControl(),
          parameters: new FormControl(null, [CustomValidators.validJSON]),
        })
    ),
    functionCall: new FormControl(),
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
    stop: new FormArrayWithFactory(() => new FormControl(null, [Validators.required]), null, [
      Validators.maxLength(4),
    ]),
    maxTokens: new FormControl(200),
    presencePenalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    frequencyPenalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    logitBias: new FormGroupWithFactory(
      () => new FormControl(0, [Validators.min(-100), Validators.max(100)]),
      {}
    ),
  });
  modelControl = this.form.controls.model as FormControl;

  readonly estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map((params: ChatCompletionOptions) =>
        ChatGPT.estimateCost(params.model, ChatGPT.chatCompletions.estimateRequestTokens(params))
      )
    )
  );
  protected readonly requestParams$ = new ReplaySubject<ChatCompletionOptions>(1);

  @Input() params: CompletionFormProjectedParams;
  @Output() request = this.requestParams$.pipe(
    map((params) => [params]),
    toRequest((params) => this.playgroundService.chatCompletionsCreate(params)),
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
          result$: (result$ as Observable<any>).pipe(map(({ result }) => result)),
          cost$: (result$ as Observable<{ result: ChatCompletionsResponse }>).pipe(
            map(
              ({ result }) => ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens
            )
          ),
          cached$: (result$ as Observable<any>).pipe(map(({ cached }) => cached)),
        };
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private parveFormValueMessagesToParamsMessages = _map(_omitBy(_isEmpty));

  private parseFormValueToParams = omitByDeep(_isEmpty);

  private setFormValueFromParams({ prompt }: CompletionFormProjectedParams) {
    this.form.get('messages').setValue(
      prompt.split('\n').map((message) => ({
        role: 'user',
        content: message,
        name: null,
        functionCall: {},
      }))
    );
  }

  ngOnChanges({ params }: SimpleChanges) {
    if (params) {
      this.setFormValueFromParams(params.currentValue);
    }
  }

  onSubmit() {
    this.requestParams$.next(this.parseFormValueToParams(this.form.value));
  }
}
