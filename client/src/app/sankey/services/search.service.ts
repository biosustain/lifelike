import { Injectable, OnDestroy, NgZone } from '@angular/core';

import { ReplaySubject, iif, of, Subject } from 'rxjs';
import { auditTime, map, switchMap, tap, first, finalize, scan, startWith, shareReplay } from 'rxjs/operators';
import { size } from 'lodash';

import { tokenizeQuery } from 'app/shared/utils/find';

import { WorkerOutputActions } from './search-worker-actions';
import { ControllerService } from './controller.service';


@Injectable()
// @ts-ignore
export class SankeySearchService implements OnDestroy {
  constructor(
    readonly common: ControllerService,
    private zone: NgZone
  ) {
  }

  // +/- index of the currently focused match
  focusIdx$ = new ReplaySubject<number>(1);

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

  matches$ = this.common.data$.pipe(
    // limit size of data we operate on
    map(({nodes, links, graph: {trace_networks}}) => ({
      nodes,
      links,
      graph: {
        trace_networks
      }
    })),
    switchMap(data => this.searchTokens$.pipe(
      switchMap(searchTokens => iif(
        // if term is empty, return empty array
        () => size(searchTokens) === 0,
        of([]),
        // as performance improvement start seaerch with visible network trace
        this.common.networkTraceIdx$.pipe(
          tap(() => this._done$.next(false)),
          // not interested in network trace change after initial run
          // results should be same independent of selected network trace
          first(),
          // build search context
          map(networkTraceIdx => {
            // create search observable for each search query
            const results$ = new Subject();
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
                // results are returned in arbitrary batches so we concat them
                scan((matches, newMatches) => matches.concat(newMatches), [])
              )
            };
          }),
          // init search
          tap(searchContext => this.startWorkerSearch(searchContext)),
          switchMap(({results$}) => results$)
        )
      ))
    )),
    // each subscriber gets same results$ (one worker)
    shareReplay(1)
  );

  preprocessedMatches$ = this.matches$.pipe(
    auditTime(500),
    //     windowToggle(this.term$, () => new Subject()),
    //     tap(searchTask$ => this.ongoingSearch$.next(searchTask$)),
    //     switchMap(currentMatches$ => currentMatches$),
    //     tap(matches => matches.sort((a, b) => a.networkTraceIdx - b.networkTraceIdx)),
    //     tap(matches => matches.sort((a, b) => b.calculatedMatches[0].priority - a.calculatedMatches[0].priority))
    //   )
    // )
  );

  searchFocus$ = this.preprocessedMatches$.pipe(
    switchMap(preprocessedMatches => {
      const {length} = preprocessedMatches;
      return this.focusIdx$.pipe(
        map(focusIdx =>
          // modulo which works on negative numbers
          preprocessedMatches[((focusIdx % length) + length) % length]
        )
      );
    })
  );

  resultsCount$ = this.preprocessedMatches$.pipe(
    map(matches => matches.length)
  );

  setUpWorker(results$) {
    console.log('setUpWorker');
    const worker = new Worker('./search.worker', {type: 'module'});
    worker.onmessage = ({data: {action, actionLoad}}) => {
      switch (action) {
        case WorkerOutputActions.match:
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
      map(focusIdx => focusIdx + value),
      tap(focusIdx => this.focusIdx$.next(focusIdx))
    );
  }

  next() {
    return this.relativeFocusIdxChange(1).toPromise();
  }

  previous() {
    return this.relativeFocusIdxChange(-1).toPromise();
  }
}
