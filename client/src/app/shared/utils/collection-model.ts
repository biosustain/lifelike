import { combineLatest, BehaviorSubject, Observable, merge } from 'rxjs';
import {
  map,
  shareReplay,
  distinctUntilChanged,
  startWith,
  pairwise,
  switchMap,
} from 'rxjs/operators';
import { has, last, uniq, isEqual, first } from 'lodash-es';

type Filter<T> = (item: T) => boolean;
type Sort<T> = (a: T, b: T) => number;

export interface ObservableObject<UpdateLoad = any> {
  readonly changed$: Observable<UpdateLoad>;
}

export class CollectionModel<T extends ObservableObject | any> {
  constructor(items: T[] = [], options: CollectionModalOptions<T> = {}) {
    if (has(options, 'multipleSelection')) {
      this.multipleSelection = options.multipleSelection;
    }
    if (has(options, 'sort')) {
      this.setSort(options.sort);
    }
    if (has(options, 'filter')) {
      this.setFilter(options.filter);
    }
    this.replace(items);
  }

  get length(): number {
    return this._items$.value.length;
  }

  multipleSelection = false;
  private readonly _updateView$ = new BehaviorSubject<boolean>(false);
  readonly filter$ = new BehaviorSubject<Filter<T>>(null);
  readonly sort$ = new BehaviorSubject<Sort<T>>(null);
  private readonly _items$ = new BehaviorSubject<Array<T>>([]);
  readonly items$: Observable<readonly T[]> = this._items$.pipe(
    switchMap((items) =>
      merge(...items.filter((i) => has(i, 'changed$')).map((i) => i.changed$)).pipe(
        startWith({}),
        map(() => Object.freeze(items))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly _selection$ = new BehaviorSubject<Array<T>>([]);
  readonly selection$: Observable<readonly T[]> = combineLatest([
    this.items$,
    this._selection$,
  ]).pipe(
    map(([items, selection]) => selection.filter((item) => items.includes(item))),
    map((items) => Object.freeze(items)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly selectionLength$ = this.selection$.pipe(
    map((items) => items.length),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly lastSelection$ = this.selection$.pipe(
    // todo cosider populating selection in reverse order
    map((selection) => last(selection)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly firstSelection$ = this.selection$.pipe(
    map((selection) => first(selection)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly selectionChanges$: Observable<CollectionChange<T>> = this.selection$.pipe(
    startWith([]),
    pairwise(),
    map(([prev, curr]) => ({
      source: this,
      added: [...curr].filter((item) => !prev.includes(item)),
      removed: [...prev].filter((item) => !curr.includes(item)),
    })),
    distinctUntilChanged(isEqual),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly view$: Observable<T[]> = combineLatest([
    this.items$,
    this.filter$,
    this.sort$,
    this._updateView$,
  ]).pipe(
    map(([items, filter, sort]) => {
      let filteredItems: T[] = [...items];
      if (filter != null) {
        filteredItems = filteredItems.filter(filter);
      }
      if (sort != null) {
        filteredItems.sort(sort);
      }
      return filteredItems;
    }),
    // share results but not keep in memory if not used
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly viewLength$ = this.view$.pipe(
    map(({ length }) => length),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  setFilter(filter: Filter<T>) {
    this.filter$.next(filter);
  }

  setSort(sort: Sort<T>) {
    this.sort$.next(sort);
  }

  updateView() {
    this._updateView$.next(true);
  }

  // seems not used in any place
  // push(item: T): void {
  //   if (!this._items.has(item)) {
  //     this._items.add(item);
  //
  //     this.viewOutdated = true;
  //
  //     this.itemChanges$.next({
  //       source: this,
  //       added: new Set<T>([item]),
  //       removed: new Set<T>(),
  //     });
  //   }
  // }

  // seems not used in any place
  // delete(item: T) {
  //   if (this._items.has(item)) {
  //     this._items.delete(item);
  //
  //     if (this._selection.delete(item)) {
  //       this.selectionChanges$.next({
  //         source: this,
  //         added: new Set<T>(),
  //         removed: new Set<T>([item]),
  //       });
  //     }
  //
  //     this.viewOutdated = true;
  //
  //     this.itemChanges$.next({
  //       source: this,
  //       added: new Set<T>(),
  //       removed: new Set<T>([item]),
  //     });
  //   }
  // }

  replace(items: T[]): void {
    this._items$.next(items);
  }

  select(...items: T[]): void {
    if (items.length) {
      if (this.multipleSelection) {
        this._selection$.next(uniq(this._selection$.value.concat(items)));
      } else {
        this._selection$.next([items.pop()]);
      }
    }
  }

  deselect(...items: T[]): void {
    this._selection$.next(this._selection$.value.filter((item) => !items.includes(item)));
  }

  selectOnly(item: T): void {
    this._selection$.next([item]);
  }

  selectAll(): void {
    this.select(...this._items$.value);
  }

  deselectAll(): void {
    this.deselect(...this._items$.value);
  }

  clear(): void {
    return this.deselectAll();
  }

  toggle(item: T): void {
    if (this.isSelected(item)) {
      this.deselect(item);
    } else {
      this.select(item);
    }
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.deselectAll();
    } else {
      this.selectAll();
    }
  }

  isAllSelected(): boolean {
    return this._selection$.value.length === this._items$.value.length;
  }

  isSelected(item: T) {
    return this._selection$.value.includes(item);
  }
}

export interface CollectionChange<T> {
  source: CollectionModel<T>;
  added: Array<T>;
  removed: Array<T>;
}

export interface CollectionModalOptions<T> {
  multipleSelection?: boolean;
  filter?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
}
