import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { isEmpty as _isEmpty, map as _map, omit as _omit } from 'lodash/fp';
import { BehaviorSubject, defer, EMPTY, Observable, ReplaySubject } from 'rxjs';
import { catchError, finalize, map, shareReplay, startWith, tap } from 'rxjs/operators';

import { ChatGPTModel } from '../../../../../services/explain.service';
import * as CustomValidators from '../../../../../utils/form/validators';
import { FormArrayWithFactory, FormGroupWithFactory } from '../../../../../utils/form/with-factory';
import { ChatCompletitionsParams, ChatGPT, CompletitionsParams } from '../../../ChatGPT';
import { WrappedRequest } from '../../../interfaces';
import { PlaygroundService } from '../../../services/playground.service';
import { CompletionForm, CompletionFormProjectedParams } from '../interfaces';

@Component({
  selector: 'app-chat-completions-form',
  templateUrl: './chat-completions-form.component.html',
})
export class ChatCompletionsFormComponent
  implements OnChanges, CompletionForm<ChatCompletitionsParams>
{
  constructor(
    private readonly playgroundService: PlaygroundService,
    public readonly cdr: ChangeDetectorRef
  ) {}

  protected readonly models$: Observable<string[]> = this.playgroundService
    .chatCompletionsModels()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  private readonly ROLES = ['system', 'user', 'assitant', 'function'];

  protected readonly form = new FormGroup({
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
          content: new FormControl(null),
          name: new FormControl(),
          function_call: new FormGroupWithFactory(() => new FormControl()),
        }),
      [],
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
    function_call: new FormControl(),
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

  protected readonly estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map((params: CompletitionsParams) =>
        ChatGPT.estimateCost(params.model, ChatGPT.chatCompletions.estimateRequestTokens(params))
      )
    )
  );
  protected readonly requestParams$ = new ReplaySubject<CompletitionsParams>(1);

  @Input() params: CompletionFormProjectedParams;
  @Output() request: Observable<WrappedRequest<CompletitionsParams, any>> =
    this.requestParams$.pipe(
      map((params) => {
        const loading$ = new BehaviorSubject(true);
        const error$ = new ReplaySubject<HttpErrorResponse>(1);
        const result$: Observable<any> = this.playgroundService.chatCompletionsCreate(params).pipe(
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

  private setFormValueFromParams({ prompt }: CompletionFormProjectedParams) {
    this.form.get('messages').setValue(
      prompt.split('\n').map((message) => ({
        role: 'user',
        content: message,
      }))
    );
  }

  ngOnChanges({ params }: SimpleChanges) {
    if (params) {
      this.setFormValueFromParams(params.currentValue);
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
}
