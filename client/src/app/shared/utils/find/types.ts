import { BehaviorSubject, Observable } from 'rxjs';

import { NodeTextRange } from '../dom';

export interface SearchControl<Results, Query> extends SearchInstance<Results, Query> {
  index$: BehaviorSubject<number>;
  count$: Observable<number>;
  current$: Observable<NodeTextRange | undefined>;
}

export interface SearchInstance<Result, Query> {
  readonly query: Query;
  readonly results$: Observable<{ all: Result[]; currentBatch: Result[] }>;
}

export interface Finder<
  Result,
  Query,
  Search extends SearchInstance<Result, Query> = SearchInstance<Result, Query>
> {
  readonly search$: Observable<Search>;
}

export interface DOMFinder<
  Result,
  Query,
  Search extends SearchInstance<Result, Query> = SearchInstance<Result, Query>
> extends Finder<Result, Query, Search> {}

interface DOMFinderConstructor {
  new (): DOMFinder<any, any, any>;

  new <Result, Query, Search extends SearchInstance<Result, Query> = SearchInstance<Result, Query>>(
    query$: Observable<string>,
    target$: Observable<Element>,
    findGenerator?: (root: Node, query: Query) => IterableIterator<Result | undefined>
  ): DOMFinder<Result, Query, Search>;

  readonly prototype: DOMFinder<any, any, any>;
}

declare var DOMFinder: DOMFinderConstructor;
