import {
  AbstractControl,
  AbstractControlOptions,
  AsyncValidatorFn,
  FormArray,
  FormGroup,
  ValidatorFn,
} from '@angular/forms';

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
  keys as _keys,
  isNull as _isNull,
  difference as _difference,
} from 'lodash/fp';

export class FormArrayWithFactory<
  Control extends AbstractControl = AbstractControl,
  T = any
> extends FormArray {
  constructor(
    private readonly factory: () => Control,
    values: T[] = [],
    validatorOrOpts?: ValidatorFn | AbstractControlOptions | ValidatorFn[],
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[]
  ) {
    super([], validatorOrOpts, asyncValidator);
    if (values) {
      this.setValue(values, { emitEvent: false });
    }
  }

  controls: Control[];

  private matchControls(valuesLength: number, remove: boolean) {
    const controlsLength = this.controls.length;
    for (let i = valuesLength; remove && i < controlsLength; i++) {
      this.removeAt(i);
    }
    for (let i = controlsLength; i < valuesLength; i++) {
      this.push(this.factory());
    }
  }

  setValue(values: T[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(values.length, true);
    super.setValue(values, options);
  }

  patchValue(values: T[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(values.length, false);
    super.patchValue(values, options);
  }

  reset(value?: T[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
    this.matchControls(value?.length ?? 0, true);
    super.reset(value, options);
  }

  add(value: T | null) {
    const control = this.factory();
    if (!_isNull(value)) {
      control.setValue(value, { emitEvent: false });
    }
    super.push(control);
  }

  removeControl(control: Control) {
    super.removeAt(this.controls.indexOf(control));
  }
}

export class FormGroupWithFactory<
  Control extends AbstractControl = AbstractControl,
  V = any
> extends FormGroup {
  constructor(
    private readonly factory: () => Control,
    mapping?: Record<string, V>,
    validatorOrOpts?: ValidatorFn | AbstractControlOptions | ValidatorFn[],
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[]
  ) {
    super({}, validatorOrOpts, asyncValidator);
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
