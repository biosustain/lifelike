import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
import { defer, Observable } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';

import { ChatGPTModel, ExplainService } from '../../../services/explain.service';
import * as CustomValidators from '../../../utils/form/custom-validators';
import { FormArrayWithFactory, FormGroupWithFactory } from '../../../utils/form/with-factory';
import { ChatGPT, CompletitionsParams } from '../ChatGPT';

@Component({
  selector: 'app-chat-gpt-form',
  templateUrl: './chat-gpt-form.component.ts.component.html',
})
export class ChatGptFormComponent implements OnChanges {

  constructor(
    private readonly explainService: ExplainService,
  ) {
  }

  @Input() temparature: number;
  @Input() prompt: string;
  @Output() readonly ngSubmit = new EventEmitter<CompletitionsParams>();

  models$: Observable<string[]> = this.explainService
    .models()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({bufferSize: 1, refCount: true}),
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
              models.includes(control.value) ? null : {notAvailable: control.value},
            ),
          ),
      ],
    ),
    prompt: new FormControl('', [Validators.required]),
    maxTokens: new FormControl(200),
    temperature: new FormControl(0, [Validators.min(0), Validators.max(2)]),
    topP: new FormControl(1),
    n: new FormControl(1, [
      CustomValidators.isInteger,
      ({value}: FormControl) => {
        const bestOf = this.form?.controls.bestOf?.value;
        if (!bestOf) {
          return null;
        }
        return value < bestOf ? {nSmallerThanBestOf: {value, bestOf}} : null;
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
      {},
    ),
  });
  // region Typed form controls to use in template
  logitBiasControl = this.form.controls.logitBias as FormGroupWithFactory;
  stopControl = this.form.controls.stop as FormArrayWithFactory;
  // endregion

  estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(startWith(this.form.value), map(ChatGPT.estimateCost)),
  );

  groupedModels$: Observable<Record<string, string[]>> = this.models$.pipe(
    map(_flow(_groupBy(ChatGPT.getModelGroup), _mapValues(_sortBy(_identity)))),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  onSubmit(): void {
    this.ngSubmit.emit(this.parseFormValueToParams(this.form.value));
  }

  ngOnChanges({temparature, prompt}: SimpleChanges): void {
    if (temparature) {
      this.form.controls.temperature.reset(temparature.currentValue);
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

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }
}
