import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
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
import { HttpErrorResponse } from '@angular/common/http';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  difference as _difference,
  flow as _flow,
  groupBy as _groupBy,
  identity as _identity,
  isEmpty as _isEmpty,
  isInteger as _isInteger,
  keyBy as _keyBy,
  keys as _keys,
  map as _map,
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
  distinctUntilChanged,
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

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { OpenFileProvider } from '../../providers/open-file/open-file.provider';
import { ChatGPTModel, ExplainService } from '../../services/explain.service';
import { ChatGPT, CompletitionsParams } from './ChatGPT';

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
    _isInteger(control.value) ? null : { notInteger: control.value },
  isBoolean: (control: AbstractControl) =>
    typeof control.value === 'boolean' ? null : { notBoolean: control.value },
  oneOf: (options: readonly any[]) => (control: AbstractControl) =>
    options.includes(control.value) ? null : { oneOf: control.value },
};

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
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
  models$: Observable<string[]> = this.explainService
    .models()
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
  formInput = new FormGroup({
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
    context: new FormControl(''),
  });
  private destroy$: Subject<void> = new Subject();
  contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({ contexts }) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  requestParams$ = new ReplaySubject<CompletitionsParams>(1);

  request$ = this.requestParams$.pipe(
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

  result$ = this.request$.pipe(
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

  estimatedCost$ = defer(() =>
    this.form.valueChanges.pipe(startWith(this.form.value), map(ChatGPT.estimateCost))
  );

  requestCost$ = this.result$.pipe(
    withLatestFrom(this.requestParams$),
    map(
      ([{ result }, params]) =>
        ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens
    )
  );

  cached$ = this.result$.pipe(map(({ cached }) => cached));

  resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result.result ?? result, null, 2)),
    catchError((error) => of(`Error: ${error}`)),
    takeUntil(this.destroy$)
  );

  resultChoices$ = this.result$.pipe(
    map(({ result }) => result?.choices ?? []),
    catchError((error) => of(`Error: ${error}`))
  );

  lastPricingUpdate = ChatGPT.lastUpdate;

  trackByIndex = ({ index }) => index;

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

  parseEntitiesToPropmpt(entities: string[], context: string) {
    return (
      'What is the relationship between ' +
      entities.join(', ') +
      (context ? `, ${context}` : '') +
      '?'
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

  private parseFormValueToParams = (formValue): CompletitionsParams =>
    _omit([
      _isEmpty(formValue.stop) ? 'stop' : null,
      _isEmpty(formValue.logitBias) ? 'logitBias' : null,
      formValue.n === 1 ? 'n' : null,
    ])(formValue) as CompletitionsParams;

  onSubmitRequest() {
    this.requestParams$.next(this.parseFormValueToParams(this.form.value));
  }

  close() {
    this.modal.close();
  }

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }
}
