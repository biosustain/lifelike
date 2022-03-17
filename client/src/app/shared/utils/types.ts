// TODO: Replace it with the null coalescing operator when we get it

export function nullCoalesce(...items) {
  for (const item of items) {
    if (item != null) {
      return item;
    }
  }
  return null;
}

export function emptyIfNull(s: any) {
  if (s == null) {
    return '';
  } else {
    return '' + s;
  }
}

export function nullIfEmpty(s: any) {
  if (s == null) {
    return null;
  } else if (!s.length) {
    return null;
  } else {
    return s;
  }
}

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Common describtion of getSet behaviour
 * (helps to keep it in sync)
 */
interface GetSet<ID, Value> {
  /**
   * Return key value if it exists in the map
   * otherwise use default value
   * @param key - used to identify value
   * @param value - default key value
   */
  getSet(id: ID, value: Value): Value;

  /**
   * Return key value if it exists in the map
   * otherwise use default value accessor
   * @param key - used to identify value
   * @param valueAccessor - value or function to calculate it
   */
  getSetLazily(id: ID, valueAccessor: () => Value): Value;
}

export class ExtendedWeakMap<K extends object, V> extends WeakMap<K, V> implements GetSet<K, V> {
  getSet(key, value) {
    if (this.has(key)) {
      return super.get(key);
    }
    super.set(key, value);
    return value;
  }

  getSetLazily(key, valueAccessor) {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = valueAccessor instanceof Function ? valueAccessor() : valueAccessor;
    super.set(key, loadedValue);
    return loadedValue;
  }
}

export class ExtendedMap<K, V> extends Map<K, V> implements GetSet<K, V> {
  getSet(key, value) {
    if (this.has(key)) {
      return super.get(key);
    }
    super.set(key, value);
    return value;
  }

  getSetLazily(key: K, valueAccessor: () => V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = valueAccessor instanceof Function ? valueAccessor() : valueAccessor;
    super.set(key, loadedValue);
    return loadedValue;
  }
}

export class ExtendedArray<V> extends Array<V> implements GetSet<number, V> {
  at: (index: number) => V;

  /**
   * Return index value if it exists in the array
   * otherwise use default value
   * (undefined is considered as not existing value
   * @param index - used to access value
   * @param value - default value
   */
  getSet(index, value) {
    const existingValue = this.at(index);
    if (existingValue !== undefined) {
      return existingValue;
    }
    this[index] = value;
    return value;
  }

  /**
   * Return index value if it exists in the array
   * otherwise use default value accessor
   * (undefined is considered as not existing value
   * @param index - used to access value
   * @param valueAccessor - default value or function to calculate it
   */
  getSetLazily(index, valueAccessor) {
    const existingValue = this.at(index);
    if (existingValue !== undefined) {
      return existingValue;
    }
    return this[index] = valueAccessor instanceof Function ? valueAccessor() : valueAccessor;
  }
}

export const frozenEmptyObject = Object.freeze({});
