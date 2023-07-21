import {
  AbstractControl,
  AbstractControlOptions,
  AsyncValidatorFn,
  FormArray,
  FormGroup,
  ValidatorFn,
} from '@angular/forms';

import { keys as _keys, difference as _difference } from 'lodash/fp';

export class FormArrayWithFactory<T = any> extends FormArray {
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

export class FormGroupWithFactory<V = any> extends FormGroup {
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
