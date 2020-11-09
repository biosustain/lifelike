export class DefaultMap<K, V> extends Map<K, V> {
  constructor(private readonly defaultFunc: () => V, entries?: readonly (readonly [K, V])[] | null) {
    super(entries);
  }

  get(key) {
    let value = super.get(key);
    if (value == null) {
      value = this.defaultFunc();
      super.set(key, value);
    }
    return value;
  }
}
