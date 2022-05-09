import { HttpErrorResponse } from '@angular/common/http';

import { catchError } from 'rxjs/operators';
import { from, Observable, pipe, throwError } from 'rxjs';
import { UnaryFunction } from 'rxjs/internal/types';
import { transform, isEqual, isObject, isEmpty } from 'lodash-es';

import { OperatingSystems } from 'app/interfaces/shared.interface';

import { FAClass, CustomIconColors, Unicodes } from './constants';

/**
 * Splits a pascal-case (e.g. "TheQuickRedFox") string, separating the words by a " " character. E.g. "The Quick Red Fox".
 * @param str the pascal-case string to split
 * @returns the input string with the words split by " "
 */
export function splitPascalCaseStr(str: string): string {
  return str
    // Look for long acronyms and filter out the last letter
    .replace(/([A-Z]+)([A-Z][a-z])/g, ' $1 $2')
    // Look for lower-case letters followed by upper-case letters
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    // Look for lower-case letters followed by numbers
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase())
    // Remove any white space left around the word
    .trim();
}

/**
 * Takes an input string and returns the title-cased version of that string. E.g., 'lazy dog' becomes 'Lazy Dog'.
 *
 * TODO: This could be smarter, since cases like '$foobar' or '"lazy dog"' have somewhat unexpected results ('$foobar' and '"lazy Dog"'
 * respectively).
 * @param str string to convert to title-case
 * @returns the title-cased version of the input string
 */
export function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt: string) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

export function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';

  [...Array(6).keys()].forEach(
    _ => color += letters[Math.floor(Math.random() * 16)],
  );

  return color;
}

/**
 * Converts a string to hex.
 * TODO: Consider a better way to encode data (e.g. base64/32)
 *
 * Use cases:
 * 1. Allow us to use various characters without having
 * to deal with escaping them in URLs
 * (i.e.) n1,n2&n3,n4 does not need to have the & escaped
 */
export function stringToHex(s: string) {
  const hexFormat = [];
  for (let i = 0, l = s.length; i < l; i++) {
    const hex = Number(s.charCodeAt(i)).toString(16);
    hexFormat.push(hex);
  }
  return hexFormat.join('');
}

/**
 * Transforms a hex code and opacity value into an rgba value.
 * @param hex hex code to turn into rgba value
 */
export function hexToRGBA(hex: string, opacity: number) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    /* tslint:disable:no-bitwise*/
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + `,${opacity})`;
  }
  throw new Error('Bad Hex');
}

/**
 * Generate a UUID. Source: https://stackoverflow.com/a/2117523
 */
export function uuidv4(): string {
  // @ts-ignore
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    /* tslint:disable:no-bitwise*/
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16),
  );
}


export function getClientOS() {
  if (navigator.appVersion.indexOf('Linux') !== -1) {
    return OperatingSystems.LINUX;
  }
  if (navigator.appVersion.indexOf('Mac') !== -1) {
    return OperatingSystems.MAC;
  }
  if (navigator.appVersion.indexOf('Win') !== -1) {
    return OperatingSystems.WINDOWS;
  }
  return OperatingSystems.UNKNOWN;

}

export function keyCodeRepresentsCopyEvent(event: any) {
  const clientOS = getClientOS();
  switch (clientOS) {
    case OperatingSystems.MAC:
    case OperatingSystems.LINUX:
    case OperatingSystems.WINDOWS: {
      return event.code === 'KeyC' && event.ctrlKey === true;
    }
    default: {
      return false;
    }
  }
}

export function keyCodeRepresentsPasteEvent(event: any) {
  const clientOS = getClientOS();
  switch (clientOS) {
    case OperatingSystems.MAC: {
      if (event.code === 'KeyV' && event.metaKey === true) {
        return true;
      }
      return false;
    }
    case OperatingSystems.LINUX:
    case OperatingSystems.WINDOWS: {
      if (event.code === 'KeyV' && event.ctrlKey === true) {
        return true;
      }
      return false;
    }
    default: {
      return false;
    }
  }
}

/**
 * Catches and swallows 404 errors, preventing it
 * from bubbling up.
 */
export function ignore404Errors<T>(): UnaryFunction<Observable<T>, Observable<T>> {
  return pipe(catchError(error => {
    if (error instanceof HttpErrorResponse) {
      const res = error as HttpErrorResponse;
      if (res.status === 404) {
        return from([null]);
      }
    }
    return throwError(error);
  }));
}

/**
 * Return elements of the first set that are not present in the second
 * @param first set to filter
 * @param second set to check against
 */
export function setDifference<T>(first: Set<T>, second: Set<T | any>): T[] {
  return [...first].filter(i => !second.has(i));
}

/**
 * Matches filename/url with supported extensions and returns its information
 */
export function getSupportedFileCodes(text: string): SupportedExtensionInfo {
  if (text.endsWith('.docx') || text.endsWith('.doc')) {
    return {
      unicode: Unicodes.Word,
      FAClass: FAClass.Word,
      color: CustomIconColors.Word
    };
  } else if (text.endsWith('.xlsx') || text.endsWith('.xls')) {
    return {
      unicode: Unicodes.Excel,
      FAClass: FAClass.Excel,
      color: CustomIconColors.Excel
    };
  } else if (text.endsWith('.pptx') || text.endsWith('.ppt')) {
    return {
      unicode: Unicodes.PowerPoint,
      FAClass: FAClass.PowerPoint,
      color: CustomIconColors.PowerPoint
    };
  } else if (text.endsWith('.cys')) {
    return {
      unicode: Unicodes.Cytoscape,
      FAClass: FAClass.Cytoscape,
      color: CustomIconColors.Cytoscape
    };
  }
  return undefined;
}


export interface SupportedExtensionInfo {
  unicode: Unicodes;
  FAClass: FAClass;
  color: CustomIconColors;
}

/**
 * Return deep diff of two objects
 * if properties are not equal returns b value
 */
export const deepDiff = ([a, b]) =>
  transform(a, (result, value, key) => {
      if (!isEqual(value, b[key])) {
        result[key] = isObject(value) && isObject(b[key]) ? deepDiff([value, b[key]]) : b[key];
      }
    }
  );

export const isNotEmpty = obj => !isEmpty(obj);

/**
 * Helper mapper function, that works not only with arrays, but also with objects, sets, maps etc.
 * It is creating a new object of same type (as of default 'mappedObjectConstructor'), with mapped values.
 * When 'mappedObjectConstructor' is set it is used to create new object.
 *
 * Mapping reflects Array.map() behaviour.
 *
 * Example:
 *   mapIterable(new Map(['a', '2']), ([key, value], index) => [value, key])
 *   // returns Map(['2', 'a'])
 *
 * @param itrable - the iterable object
 * @param mapping - the mapping function
 * @param mappedObjectConstructor - contructor
 */
export const mapIterable = <O, R>(itrable, mapping, mappedObjectConstructor?) =>
  new (mappedObjectConstructor ?? itrable.constructor)(Array.from(itrable, mapping));

/** Unique Symbol to be used as defualt value of parameter.
 * We want to use it so we are not running into issue of differentiate between
 * passed undefined and not provided parameter.
 */
export const notDefined = Symbol('notDefined');

/**
 * Helper reducer function, that works not only with arrays, but also with objects, sets, maps etc.
 * This method does not create intermidiate array in memory.
 *
 * Reduce behaves like Array.reduce()
 *
 * Example:
 *   reduce(new Set([1, 2, 3]), (acc, val) => acc + val, 0)
 *   // returns 6
 *
 * @param itrable - the iterable object
 * @param callbackfn - A “reducer” function that takes four arguments:
 *  + previousValue: the value resulting from the previous call to callbackFn.
 *    On first call, initialValue if specified, otherwise the first value of iterable.
 *  + currentValue: the value of the current element.
 *    On first call, the first value of iterable if an initialValue was specified,
 *    otherwise the second value of iterable.
 *  + currentIndex: the index position of currentValue in the iterable.
 *    On first call, 0 if initialValue was specified, otherwise 1.
 *  + iterable: the itrable beeing traversed.
 * @param initialValue - A value to which previousValue is initialized the first time the callback is called. If initialValue is specified,
 *   that also causes currentValue to be initialized to the first value in the array. If initialValue is not specified, previousValue is
 *   initialized to the first value in the array, and currentValue is initialized to the second value in the array.
 */
export const reduceIterable = (itrable, callbackfn, initialValue: any = notDefined) => {
  const interator = itrable[Symbol.iterator]();
  let currentIndex = 0;
  if (initialValue === notDefined) {
    const {done, value} = interator.next();
    if (done) {
      return undefined;
    }
    initialValue = value;
    currentIndex++;
  }
  for (const value of interator) {
    initialValue = callbackfn(initialValue, value, currentIndex++, itrable);
  }
  return initialValue;
};

export const inText = (pattern: string, flags: string = 'i') => {
  const compiledExpresion = new RegExp(pattern, flags);
  return (text: string) => compiledExpresion.test(text);
};

export const isPromise = value => typeof value?.then === 'function';
