import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

import {
  filter as _filter,
  has as _has,
  map as _map,
  flow as _flow,
  isObject as _isObject,
  isArray as _isArray,
  fromPairs as _fromPairs,
  zip as _zip,
  pickBy as _pickBy, mapValues as _mapValues,
} from 'lodash/fp';

export function getTopParent(control: AbstractControl) {
  let parent = control;
  while (parent.parent != null) {
    parent = parent.parent;
  }
  return parent;
}

export function objectToFormData(object: object): FormData {
  const formData: FormData = new FormData();
  for (const [key, value] of Object.entries(object)) {
    if (value == null) {
      // Do nothing
    } else if (value instanceof Blob) {
      // Handle file upload
      formData.append(key, value);
    } else if (typeof value === 'boolean') {
      formData.append(key, value ? 'true' : 'false');
    } else if (typeof value === 'object') {
      throw new Error('cannot put an object value into a FormData');
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}

export function objectToMixedFormData(object: object): FormData {
  const data = {};
  const formData: FormData = new FormData();
  for (const [key, value] of Object.entries(object)) {
    if (value instanceof Blob) {
      formData.append(key, value);
    } else {
      if (value?.[0]?.blob instanceof Blob) {
        for (const imageBlob of value) {
          formData.append(key, imageBlob.blob, imageBlob.filename || 'blob');
        }
      } else {
        data[key] = value;
      }
    }
  }
  formData.append('json$', JSON.stringify(data));
  return formData;
}

export interface ImageBlob {
  blob: Blob;
  filename: string;
}

export function getFormChangedValues(form: AbstractControl, flag = 'dirty') {
  if (_has('controls')(form)) {
    const controls = (form as any).controls;
    if (_isObject(controls)) {
      return _flow(
        // Return only changed values
        _pickBy((control: AbstractControl) => control[flag]),
        _mapValues((control: AbstractControl) => getFormChangedValues(control, flag)),
      )(controls)
    }
    if (_isArray(controls)) {
      return _flow(
        _filter((control: AbstractControl) => control[flag]),
        _map((control: AbstractControl) => getFormChangedValues(control, flag)),
      )(controls);
    }
  }
  return form.value;
}
