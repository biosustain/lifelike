export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type RecursiveReadonly<T> = {
  readonly [P in keyof T]: RecursiveReadonly<T[P]>;
};

export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

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

  getSetLazily(key: K, valueAccessor: (key: K) => V) {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = valueAccessor instanceof Function ? valueAccessor(key) : valueAccessor;
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

  getSetLazily(key: K, valueAccessor: (key: K) => V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = valueAccessor instanceof Function ? valueAccessor(key) : valueAccessor;
    super.set(key, loadedValue);
    return loadedValue;
  }

  filter(filterCallback) {
    const iterator = this[Symbol.iterator]();
    const filtered = new ExtendedMap<K, V>();
    let currentIndex = 0;
    for (const value of iterator) {
      if (filterCallback(value, currentIndex++, this)) {
        filtered.set(value[0], value[1]);
      }
    }
    return filtered;
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
    return this[index] = valueAccessor instanceof Function ? valueAccessor(index) : valueAccessor;
  }
}

export const frozenEmptyObject = Object.freeze({});

export function assignDefined(target, source) {
  Object.keys(source).map((key, _) => {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  });


  return target;
}
