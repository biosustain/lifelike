import { partial as _partial } from 'lodash/fp';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  last,
  map,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';

import { FindController } from './find-controller';
import { idleBatchIterate } from '../../rxjs/idle-observable';
import { debug } from '../../rxjs/debug';
import { DOMFinder } from './types';
import { mod } from '../math';

/**
 * A find controller for finding items within an element.
 */
export class AsyncElementFindController<Results, Query> implements FindController<Results, Query> {
  protected readonly textFinder = new AsyncElementTextFinder(
    this.query$,
    this.target$,
    this.findGenerator$
  );

  public readonly search$ = this.textFinder.search$.pipe(
    debug('search$'),
    map((search) => {
      const index$ = new BehaviorSubject(0);
      return {
        ...search,
        index$,
        current$: combineLatest([index$, search.results$]).pipe(
          // It will fire for each results change
          map(([index, { all }]) => all[index] ?? null),
          distinctUntilChanged(), // but this will only fire when the current result changes
          shareReplay(1)
        ),
        count$: search.results$.pipe(
          map(({ all }) => all.length),
          shareReplay(1)
        ),
        active$: search.results$.pipe(
          last(),
          map(() => false),
          startWith(true)
        ),
      };
    }),
    shareReplay(1)
  );

  constructor(
    public readonly query$: Subject<Query>,
    protected readonly target$: Observable<Element>,
    private readonly findGenerator$: Observable<
      (***ARANGO_USERNAME***: Node, query: Query) => IterableIterator<Results | undefined>
    >
  ) {}

  private changeIndex(delta): Promise<number> {
    return this.search$
      .pipe(
        switchMap(({ index$, count$ }) =>
          count$.pipe(
            map((count: number) => mod(index$.value + delta, count)),
            tap((index: number) => index$.next(index))
          )
        ),
        take(1)
      )
      .toPromise();
  }

  previous(): Promise<number> {
    return this.changeIndex(-1);
  }

  next(): Promise<number> {
    return this.changeIndex(1);
  }
}

/**
 * Asynchronously finds text in a document.
 */
class AsyncElementTextFinder<Result, Query> implements DOMFinder<Result, Query> {
  // TODO: Handle DOM changes mid-find

  public readonly search$ = combineLatest([this.query$, this.target$, this.generator$]).pipe(
    map(
      ([query, target, generator]: [
        Query,
        Element,
        (***ARANGO_USERNAME***: Node, query: Query) => IterableIterator<Result | undefined>
      ]) => {
        const results$ = idleBatchIterate(_partial(generator, [target, query]), {
          timeout: 100,
        }).pipe(
          scan(
            ({ all }, currentBatch: Result[]) => ({
              all: all.concat(currentBatch),
              currentBatch,
            }),
            {
              all: [] as Result[],
              currentBatch: [] as Result[],
            }
          ),
          debug('results$'),
          shareReplay(1)
        );
        return {
          query,
          results$,
        };
      }
    ),
    shareReplay(1)
  );

  constructor(
    private readonly query$: Observable<Query>,
    private readonly target$: Observable<Element>,
    private readonly generator$: Observable<
      (***ARANGO_USERNAME***: Node, query: Query) => IterableIterator<Result | undefined>
    >
  ) {}

  /**
   * Example generator that finds text in a document.
   *  private* defaultGenerator(
   *    ***ARANGO_USERNAME***: Node,
   *    query: string | undefined | null,
   *  ): IterableIterator<NodeTextRange | undefined> {
   *    if (!query) {
   *      return;
   *    }
   *    const queue: Node[] = [***ARANGO_USERNAME***];
   *
   *    while (queue.length !== 0) {
   *      const node = queue.shift();
   *      if (node == null) {
   *        break;
   *      }
   *
   *      switch (node.nodeType) {
   *        case Node.ELEMENT_NODE:
   *          for (let child = node.firstChild; child; child = child.nextSibling) {
   *            queue.push(child);
   *          }
   *          break;
   *
   *        case Node.TEXT_NODE:
   *          const regex = new RegExp(_escapeRegExp(query), 'ig');
   *          while (true) {
   *            const match = regex.exec(node.nodeValue);
   *            if (match === null) {
   *              break;
   *            }
   *            yield {
   *              startNode: node,
   *              endNode: node,
   *              start: match.index,
   *              end: regex.lastIndex,
   *            };
   *          }
   *      }
   *    }
   *  }
   */
}
