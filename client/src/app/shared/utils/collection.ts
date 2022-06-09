import { transform, entries, mergeWith, forEach, toPairsIn } from 'lodash-es';

/**
 * Transpose array of obcjects into object of arrays.
 *
 * Example:
 *  transpose([{a:1, b:2}, {a:11, b:22, c:33}])
 *  => {a:[1,11], b:[2,22], c:[33]}
 */
export const transpose = <T extends object>(arrObj: T[]) =>
  transform(
    arrObj,
    (accumulator, object) =>
      forEach(
        toPairsIn(object),
        ([key, value]) =>
          accumulator[key] = (accumulator[key] ?? []).concat(value)
      ),
    {} as T
  );

type Mapping<T> = (...args: T[]) => T;
type AgregationMappingType<T extends object> = {
  [P in keyof T]?: Mapping<T[P]>
};

/**
 * Given set of objects combine their properties together ussing agregationMapping.
 *
 * Example:
 *  aggregate([{a:1, b:2}, {a:11, b:22, c:33}], {})
 *  => {a:[1,11], b:[2,22], c:[33]}
 *  aggregate([{a:1, b:2}, {a:11, b:22, c:33}], {a:Math.max, b:Math.min})
 *  => {a:11, b:2, c:[33]}
 */
export const aggregate = <T extends object>(arrObj: T[], agregationMapping: AgregationMappingType<T>) =>
  mergeWith(
    transpose(arrObj),
    agregationMapping,
    (values = [], agregationCallback = v => v) => agregationCallback(...values)
  );
