import { isDevMode } from '@angular/core';

import { map } from 'rxjs/operators';
import { cloneDeepWith, partialRight } from 'lodash-es';
import { MonoTypeOperatorFunction } from 'rxjs';

import { skipStep } from './skipStep';

/**
 * Operator to deeply freeze observable value in development.
 *
 * Reasoning: Freezing does usually add little/no value in production,
 * but introduces overhead. On the other hand it is nice development tool.
 *
 * Example:
 * ```
 * const obj = {
 *   prop: false
 * };
 * const obs = of(obj).pipe($freezeInDev, tap(obj => obj.prop = true)).subscribe();
 * // Throws an error in development (in strict mode)
 * ```
 *
 * PS isDevMode cannot be called on load of this file, as of Angular limitation.
 */
export const $freezeInDev: MonoTypeOperatorFunction<any> = map(d => isDevMode() ? cloneDeepWith(d, Object.freeze) : d);
