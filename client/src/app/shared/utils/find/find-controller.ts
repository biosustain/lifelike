import { Observable, Subject } from 'rxjs';

import { Finder, SearchInstance } from './types';

interface FindControllerSearchInstance<Result, Query> extends SearchInstance<Result, Query> {
  /**
   * Query beeing search for.
   */
  query: Query;

  /**
   * Gets whether a find is in progress.
   */
  active$: Observable<boolean>;

  /**
   * The current result index, from -1 to N-1. If it's -1, that means that the find
   * is not yet focused on a match.
   */
  index$: Observable<number>;

  /**
   * The current result, or undefined if there is no current result.
   */
  current$: Observable<Result | undefined>;

  /**
   * The number of matches.
   */
  count$: Observable<number>;
}

/**
 * Manages the process of finding some text within something.
 */
export interface FindController<Result, Query>
  extends Finder<Result, Query, FindControllerSearchInstance<Result, Query>> {
  /**
   * The query to search for.
   */
  query$: Subject<Query>;

  /**
   * Go to the previous result. Does nothing if no find is active.
   *
   * @return true if a find is active and there was a result
   */
  previous(): Promise<number>;

  /**
   * Go to the next result. Does nothing if no find is active.
   *
   * @return true if a find is active and there was a result
   */
  next(): Promise<number>;
}
