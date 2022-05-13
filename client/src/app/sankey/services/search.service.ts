import { Injectable } from '@angular/core';

import { ReplaySubject, iif, of, Subject, Observable, merge, BehaviorSubject } from 'rxjs';
import {
  map,
  switchMap,
  tap,
  first,
  finalize,
  scan,
  shareReplay,
  distinctUntilChanged,
  throttleTime,
  filter,
  pairwise,
  skip
} from 'rxjs/operators';
import { size, isNil, isEmpty } from 'lodash-es';

import { tokenizeQuery } from 'app/shared/utils/find';
import { debug } from 'app/shared/rxjs/debug';

import { WorkerOutputActions } from '../interfaces/search-worker-actions';
import { ControllerService } from './controller.service';
import { Match } from '../interfaces/search';

@Injectable()
export class SankeySearchService {
  constructor(
    readonly common: ControllerService
  ) {
  }

  term$ = new ReplaySubject<string>(1);

  searchTokens$ = this.term$.pipe(
    map(term => {
      if (!term) {
        return [];
      }
      return tokenizeQuery(term, {singleTerm: true});
    })
  );

  private _done$ = new ReplaySubject<boolean>(1);
  done$ = this._done$.asObservable();

  currentSearch$ = this.common.data$.pipe(
    // limit size of data we operate on
    map(({nodes, links, graph: {traceNetworks}}) => ({
      nodes,
      links,
      graph: {
        traceNetworks
      }
    })),
    switchMap(data => this.searchTokens$.pipe(
      switchMap(searchTokens => iif(
        // if term is empty, return empty array
        () => isEmpty(searchTokens),
        // returning completed search observable so empty value propagates
        of(of([])),
        // as performance improvement start seaerch with visible network trace
        this.common.networkTraceIdx$.pipe(
          tap(() => this._done$.next(false)),
          // not interested in network trace change after initial run
          // results should be same independent of selected network trace
          first(),
          // build search context
          map(networkTraceIdx => {
            // create search observable for each search query
            const results$ = new Subject<Match>();
            // init web worker for this query (only this web worker sends results$.next results$.complete)
            // beside that complete is only called when results$ gets destryoed
            const worker = this.setUpWorker(results$);
            return {
              data,
              searchTokens,
              networkTraceIdx,
              worker,
              results$: results$.pipe(
                // if pipe errors or completes then stop worker
                finalize(() => {
                  worker.terminate();
                  this._done$.next(true);
                }),
                // results are returned one by one so we accumulate them
                scan((matches, newMatch) => {
                  matches.push({
                    // save idx so we can ref it later
                    idx: size(matches),
                    ...newMatch
                  });
                  return matches;
                }, [] as Match[]),
                debug('search results'),
                shareReplay<Match[]>(1)
              )
            };
          }),
          // init search
          tap(searchContext => this.startWorkerSearch(searchContext)),
          map(({results$}) => results$)
        )
      ))
    )),
    debug('current search'),
    // each subscriber gets same results$ (one worker)
    shareReplay<Observable<Match[]>>(1)
  );

  // index of the currently focused match
  private _focusIdx$ = new BehaviorSubject<number | null>(null);
  focusIdx$: Observable<number> = merge(
    this._focusIdx$,
    this.currentSearch$.pipe(
      // when search starts
      switchMap(() => this.preprocessedMatches$.pipe(
        // only when search updates
        skip(1),
        switchMap(matches =>
          this.searchFocus$.pipe(
            // what was last known search focus before this update?
            pairwise(),
            // map to index in current search results
            map(([prevSearchFocus]) => matches.indexOf(prevSearchFocus)),
            // we are not interested in subsequnt updates especially that we are about to init them
            first(),
            switchMap(focusIdx => iif(
              // does it map to current search results? (it should!)
              () => focusIdx !== -1,
              of(focusIdx)
              // stop propagation if it doesn't
            ))
          )
        )
      ))
    )
  ).pipe(
    debug('focus idx'),
    shareReplay({bufferSize: 1, refCount: true})
  );

  matches$ = this.currentSearch$.pipe(
    switchMap(results$ => results$)
  );

  preprocessedMatches$ = this.matches$.pipe(
    throttleTime(0, undefined, {leading: false, trailing: true}),
    debug('preprocessed matches'),
    // each subscriber gets same results$ (one worker)
    shareReplay<Match[]>(1)
  );

  searchFocus$ = this.preprocessedMatches$.pipe(
    switchMap(preprocessedMatches => this.focusIdx$.pipe(
        map(focusIdx => preprocessedMatches[focusIdx]),
        filter(searchFocus => Boolean(searchFocus)),
        switchMap(searchFocus =>
          this.common.setState({
            networkTraceIdx: searchFocus.networkTraceIdx
          }).pipe(
            map(() => searchFocus)
          ))
      )
    ),
    shareReplay({bufferSize: 1, refCount: true})
  );

  resultsCount$ = this.preprocessedMatches$.pipe(
    map(size),
    distinctUntilChanged(),
    debug('results count'),
    shareReplay<number>(1)
  );

  setFocusIdx(focusIdx: number) {
    return this.resultsCount$.pipe(
      // modulo which works on negative numbers
      map(resultsCount => ((focusIdx % resultsCount) + resultsCount) % resultsCount),
      distinctUntilChanged(),
      tap(idx => this._focusIdx$.next(idx))
    );
  }

  setUpWorker(results$) {
    const worker = new Worker('../utils/search/search.worker', {type: 'module'});
    worker.onmessage = ({data: {action, actionLoad}}) => {
      switch (action) {
        case WorkerOutputActions.match:
          results$.next(actionLoad);
          break;
        case WorkerOutputActions.update:
          results$.next(actionLoad);
          break;
        case WorkerOutputActions.done:
          results$.complete();
          break;
      }
    };
    worker.onerror = event => results$.error(event);
    return worker;
  }

  startWorkerSearch({worker, searchTokens, data, networkTraceIdx, options = {wholeWord: false}}) {
    worker.postMessage({
      searchTokens,
      data,
      options,
      networkTraceIdx
    });
  }

  relativeFocusIdxChange(value: number) {
    return this.focusIdx$.pipe(
      first(),
      map(focusIdx =>
        isNil(focusIdx) ?
          // prev from no focus -> last (-1)
          // next from no focus -> first (0)
          (value < 0 ? value : 0) :
          focusIdx + value
      ),
      switchMap(focusIdx => this.setFocusIdx(focusIdx))
    );
  }

  next() {
    return this.relativeFocusIdxChange(1).toPromise();
  }

  previous() {
    return this.relativeFocusIdxChange(-1).toPromise();
  }
}
