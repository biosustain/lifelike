import { Injectable, OnDestroy, NgZone } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';
import { isNil } from 'lodash-es';
import { auditTime, map, switchMap, tap } from 'rxjs/operators';

import { FindOptions, tokenizeQuery } from 'app/shared/utils/find';

import { WorkerActions, WorkerOutputActions } from './search-worker-actions';
import { SearchEntity } from './search-match';
import { SankeyTraceNetwork } from '../interfaces';
import { ControllerService } from './controller.service';

@Injectable()
// @ts-ignore
export class SankeySearchService implements OnDestroy {
  constructor(
    readonly common: ControllerService,
    private zone: NgZone
  ) {
    if (typeof Worker !== 'undefined') {
      this.setUpWorker();
    } else {
      //  fallback
    }

    zone.runOutsideAngular(() =>
      this.common.networkTraces$.pipe(
        switchMap(networkTraces => this.matches.pipe(
          auditTime(500),
          switchMap(matches => this.common.networkTraceIdx$.pipe(
            map(networkTraceIdx => matches
              .sort((a, b) => a.networkTraceIdx - b.networkTraceIdx)
              .filter(match => isNil(match.networkTraceIdx) || match.networkTraceIdx !== networkTraceIdx)
              .map((match: SearchEntity & { networkTrace: SankeyTraceNetwork }) => {
                if (!isNil(match.networkTraceIdx)) {
                  match.networkTrace = networkTraces[match.networkTraceIdx];
                }
                return match;
              })
            )
          ))
        ))
      ).subscribe(matches => {
        this.zone.run(() =>
          this.entitySearchList.next(matches.sort((a, b) => b.calculatedMatches[0].priority - a.calculatedMatches[0].priority))
        );
      })
    );

    this.searchFocus = this.entitySearchListIdx.pipe(
      map(entitySearchListIdx => this.entitySearchList.value[entitySearchListIdx])
    );

    this.entitySearchTerm.subscribe(entitySearchTerm => {
      this.searchTerms = tokenizeQuery(
        entitySearchTerm,
        {singleTerm: true}
      );
      this.entitySearchListIdx.next(-1);
      if (entitySearchTerm) {
        this.findMatching(
          this.searchTerms,
          {wholeWord: false}
        );
      } else {
        this.entitySearchList.next([]);
      }
    });
  }

  entitySearchListIdx = new BehaviorSubject<number>(-1);

  worker: Worker;
  matches = new BehaviorSubject<SearchEntity[]>([]);
  done;

  entitySearchTerm = new BehaviorSubject<string>('');
  entitySearchList = new BehaviorSubject<SearchEntity[]>([]);

  searchFocus: Observable<SearchEntity>;

  searchTerms = [];

  setUpWorker() {
    this.worker = new Worker('./search.worker', {type: 'module'});
    this.worker.onmessage = ({data: {action, actionLoad}}) => {
      switch (action) {
        case WorkerOutputActions.match:
          this.matches.next(
            this.matches.value.concat(actionLoad)
          );
          break;
        case WorkerOutputActions.interrupted:
          this.matches.next([]);
          break;
        case WorkerOutputActions.done:
          this.done = true;
          break;
      }
    };
  }

  ngOnDestroy() {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  workerUpdate(updateObj) {
    this.worker.postMessage({
      action: WorkerActions.update,
      actionLoad: updateObj
    });
  }

  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options additional find options
   */
  findMatching(terms: string[], options: FindOptions = {}) {
    this.workerStopSearch();
    this.workerClear();
    return this.common.data$.pipe(
      tap(data => this.workerUpdate({
        terms,
        options,
        data,
        dataToSearch: data
      })),
      tap(() => this.workerSearch())
    );
  }

  search(query?: string) {
    this.entitySearchTerm.next(query ?? this.entitySearchTerm.value);
  }

  workerSearch() {
    this.done = false;
    this.worker.postMessage({
      action: WorkerActions.search
    });
  }

  clearSearchQuery() {
    this.entitySearchTerm.next('');
    this.search();
  }

  next() {
    const currentEntitySearchListIdx = this.entitySearchListIdx.value;
    if (currentEntitySearchListIdx >= this.entitySearchList.value.length - 1) {
      this.entitySearchListIdx.next(0);
    } else {
      this.entitySearchListIdx.next(currentEntitySearchListIdx + 1);
    }
  }

  previous() {
    const currentEntitySearchListIdx = this.entitySearchListIdx.value;
    if (currentEntitySearchListIdx <= 0) {
      this.entitySearchListIdx.next(this.entitySearchList.value.length - 1);
    } else {
      this.entitySearchListIdx.next(currentEntitySearchListIdx - 1);
    }
  }

  private workerStopSearch() {
    this.worker.postMessage({action: WorkerActions.stop});
  }

  workerClear() {
    this.matches.next([]);
  }
}
