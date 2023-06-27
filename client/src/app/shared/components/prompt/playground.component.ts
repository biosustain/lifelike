import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import {
  AbstractControl,
  AbstractControlOptions,
  AsyncValidatorFn,
  FormArray,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { isInteger } from 'lodash-es';
import {
  difference as _difference,
  first as _first,
  isEmpty,
  keys as _keys,
  mapValues as _mapValues,
} from 'lodash/fp';

import { defer, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  withLatestFrom,
} from 'rxjs/operators';
import { OpenFileProvider } from '../../providers/open-file/open-file.provider';

import { ExplainService } from '../../services/explain.service';

class FormArrayWithFactory<T = any> extends FormArray {
  constructor(
    private readonly factory: () => AbstractControl,
    values: T[] = [],
    validatorOrOpts?: ValidatorFn | AbstractControlOptions | ValidatorFn[],
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[]
  ) {
    super([], validatorOrOpts, asyncValidator);
    if (values) {
      this.setValue(values, { emitEvent: false });
    }
  }

  private matchControls(valuesLength: number, remove: boolean = false) {
    const conlrolsLength = this.controls.length;
    for (let i = valuesLength; i < conlrolsLength; i++) {
      this.removeAt(i);
    }
    for (let i = conlrolsLength; i < valuesLength; i++) {
      this.push(this.factory());
    }
  }

  setValue(values: T[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(values.length, true);
    super.setValue(values, options);
  }

  patchValue(values: T[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(values.length);
    super.patchValue(values, options);
  }

  add(value: T) {
    const control = this.factory();
    control.setValue(value, { emitEvent: false });
    super.push(control);
  }

  removeControl(control: AbstractControl) {
    super.removeAt(this.controls.indexOf(control));
  }
}

class FormGroupWithFactory<V = any> extends FormGroup {
  constructor(
    private readonly factory: () => AbstractControl,
    mapping?: Record<string, V>,
    validatorOrOpts?: ValidatorFn | AbstractControlOptions | ValidatorFn[],
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[]
  ) {
    super(mapping ? {} : null, validatorOrOpts, asyncValidator);
    if (mapping) {
      this.setValue(mapping, { emitEvent: false });
    }
  }

  private matchControls(valuesKeys: string[], remove: boolean = false) {
    const conlrolsKeys = _keys(this.controls);
    _difference(conlrolsKeys, valuesKeys).forEach((key) => this.removeControl(key));
    _difference(valuesKeys, conlrolsKeys).forEach((key) => this.addControl(key, this.factory()));
  }

  setValue(values: Record<string, V>, options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(_keys(values), true);
    super.setValue(values, options);
  }

  patchValue(values: V[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(_keys(values), true);
    super.patchValue(values, options);
  }

  add(key: string, value?: V) {
    const control = this.factory();
    control.setValue(value, { emitEvent: false });
    super.addControl(key, control);
  }
}

// tslint:disable-next-line:variable-name
const CustomValidators = {
  isInteger: (control: AbstractControl) =>
    isInteger(control.value) ? null : { notInteger: control.value },
  isBoolean: (control: AbstractControl) =>
    typeof control.value === 'boolean' ? null : { notBoolean: control.value },
  oneOf: (options: readonly any[]) => (control: AbstractControl) =>
    options.includes(control.value) ? null : { oneOf: control.value },
};

@Component({
  selector: 'app-playground',
  templateUrl: './playground.component.html',
})
export class PlaygroundComponent implements OnDestroy, OnChanges, OnInit {
  constructor(
    private readonly openFileProvider: OpenFileProvider,
    private readonly explainService: ExplainService,
    private readonly modal: NgbActiveModal
  ) {}

  @Input() entities: Iterable<string>;
  @Input() temperature: number;
  @Input() context: number;
  readonly modelOptions = Object.freeze([
    'text-davinci-003',
    'text-davinci-002',
    'text-curie-001',
    'text-babbage-001',
    'text-ada-001',
  ]);
  form = new FormGroup({
    timeout: new FormControl(60),
    model: new FormControl(_first(this.modelOptions), [
      Validators.required,
      CustomValidators.oneOf(this.modelOptions),
    ]),
    prompt: new FormControl('', [Validators.required]),
    max_tokens: new FormControl(200),
    temperature: new FormControl(0, [Validators.min(0), Validators.max(2)]),
    top_p: new FormControl(1),
    n: new FormControl(1, [CustomValidators.isInteger]),
    stream: new FormControl(false, [CustomValidators.isBoolean]),
    logprobs: new FormControl(null, [Validators.max(5), CustomValidators.isInteger]),
    echo: new FormControl(false, [CustomValidators.isBoolean]),
    stop: new FormArrayWithFactory(() => new FormControl(null, [Validators.required]), null, [
      Validators.maxLength(4),
    ]),
    presence_penalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    frequency_penalty: new FormControl(0, [Validators.min(-2), Validators.max(2)]),
    best_of: new FormControl(1, [
      ({ value }: FormControl) => {
        const n = this.form?.controls.n?.value;
        if (!n) {
          return null;
        }
        return value < n ? { bestOfSmallerThanN: { value, n } } : null;
      },
      CustomValidators.isInteger,
    ]),
    logit_bias: new FormGroupWithFactory(
      () => new FormControl(0, [Validators.min(-100), Validators.max(100)]),
      {}
    ),
  });
  formInput = new FormGroup({
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
    context: new FormControl(''),
  });
  private destroy$: Subject<void> = new Subject();
  private contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({ contexts }) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  submitRequest$ = new Subject<void>();

  requestParams$ = this.submitRequest$.pipe(
    map(() => this.form.value),
    map(({ stop, ...rest }) => ({
      ...rest,
      stop: isEmpty(stop) ? null : stop,
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  result$ = this.requestParams$.pipe(
    map(() => this.form.value),
    switchMap(({ stop, ...rest }) =>
      this.explainService.playground({
        ...rest,
        stop: isEmpty(stop) ? null : stop,
      })
    ),
    catchError((error) => of(error)),
    takeUntil(this.destroy$)
  );

  modelTokenCostMap = new Map<string, number>([
    ['text-davinci-003', 0.02 / 1e3],
    ['text-davinci-002', 0.02 / 1e3],
    ['text-curie-001', 0.002 / 1e3],
    ['text-babbage-001', 0.0005 / 1e3],
    ['text-ada-001', 0.0004 / 1e3],
  ]);

  estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map(({ model, prompt, echo, best_of, n, max_tokens }) => {
        // https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
        const promptTokens = Math.ceil((prompt.split(' ').length * 4) / 3);
        const modelCost = this.modelTokenCostMap.get(model);
        return [
          (promptTokens + promptTokens * best_of + echo * promptTokens) * modelCost,
          (promptTokens + max_tokens * best_of + echo * promptTokens) * modelCost,
        ];
      })
    )
  );

  requestCost$ = this.result$.pipe(
    withLatestFrom(this.requestParams$),
    map(
      ([{ result }, params]) =>
        this.modelTokenCostMap.get(params.model) * result?.usage?.total_tokens
    )
  );

  cached$ = this.result$.pipe(map(({ cached }) => cached));

  resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result.result ?? result, null, 2)),
    takeUntil(this.destroy$)
  );

  resultText$ = this.result$.pipe(map(({ result }) => result?.choices?.[0]?.text));

  ngOnChanges({ entities, context, temperature }: SimpleChanges) {
    if (entities) {
      this.formInput.controls.entities.setValue(Array.from(entities.currentValue));
    }
    if (context) {
      this.formInput.controls.context.setValue(context.currentValue);
    }
    if (temperature) {
      this.form.controls.temperature.setValue(temperature.currentValue);
    }
  }

  ngOnInit(): void {
    this.onSubmitPropmptComposer();
  }

  programaticChange(inputs) {
    Object.assign(this, inputs);
    this.ngOnChanges(_mapValues((currentValue) => ({ currentValue }))(inputs) as SimpleChanges);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  parseEntitiesToPropmpt(entities: string[], _in: string) {
    return (
      'What is the relationship between ' + entities.join(', ') + (_in ? ` in ${_in}` : '') + '?'
      // + '\nPlease provide URL sources for your answer.'
    );
  }

  onSubmitPropmptComposer() {
    return this.form.controls.prompt.setValue(
      this.parseEntitiesToPropmpt(
        this.formInput.controls.entities.value,
        this.formInput.controls.context.value
      ),
      {
        onlySelf: false,
        emitEvent: true,
        emitModelToViewChange: true,
        emitViewToModelChange: true,
      }
    );
  }

  onSubmitRequest() {
    this.submitRequest$.next();
  }

  close() {
    this.modal.close();
  }
}
