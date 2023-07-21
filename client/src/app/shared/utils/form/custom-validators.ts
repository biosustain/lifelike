import { AbstractControl } from '@angular/forms';

import { isInteger as _isInteger } from 'lodash/fp';


export const isInteger = (control: AbstractControl) =>
  _isInteger(control.value) ? null : {notInteger: control.value}
export const isBoolean = (control: AbstractControl) =>
  typeof control.value === 'boolean' ? null : {notBoolean: control.value}
export const oneOf = (options: readonly any[]) => (control: AbstractControl) =>
  options.includes(control.value) ? null : {oneOf: control.value}
