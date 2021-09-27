import { AbstractControl } from '@angular/forms';

import { toValidLink } from './utils/browser';

export function nonEmptyList(control: AbstractControl): { [key: string]: any } | null {
  return control.value.length === 0 ? {required: {value: control.value}} : null;
}

export function url(control: AbstractControl): { [key: string]: any } | null {
  const value = control.value;
  if (value != null && value.length) {
    if (value.match(/^(http|ftp)s?:\/\//i)) {
      return null;
    } else {
      return {
        url: {value},
      };
    }
  } else {
    return null;
  }
}

export function potentiallyInternalUrl(control: AbstractControl): { [key: string]: any } | null {
  const value = control.value;
  if (value != null && value.length) {
    try {
      toValidLink(value);
      return null;
    } catch (e) {
      return {
        url: {value},
      };
    }
  } else {
    return null;
  }
}
