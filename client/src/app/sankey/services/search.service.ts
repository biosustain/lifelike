import { Injectable, OnDestroy } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { WorkerActions } from './search-worker-actions';

@Injectable()
// @ts-ignore
export class SankeySearchService implements OnDestroy {
  worker: Worker;
  matches = new BehaviorSubject([]);
  done;

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.setUpWorker();
    } else {
      //  fallback
    }
  }

  setUpWorker() {
    // todo
    // this.worker = new Worker('./search.worker', {type: 'module'});
    // this.worker.onmessage = ({data: {action, actionLoad}}) => {
    //   switch (action) {
    //     case WorkerOutputActions.match:
    //       this.matches.next(
    //         this.matches.value.concat(actionLoad)
    //       );
    //       break;
    //     case WorkerOutputActions.interrupted:
    //       this.matches.next([]);
    //       break;
    //     case WorkerOutputActions.done:
    //       this.done = true;
    //       break;
    //   }
    // };
  }

  ngOnDestroy() {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  update(updateObj) {
    this.worker.postMessage({
      action: WorkerActions.update,
      actionLoad: updateObj
    });
  }

  search() {
    this.done = false;
    this.worker.postMessage({
      action: WorkerActions.search
    });
  }

  stopSearch() {
    this.worker.postMessage({
      action: WorkerActions.stop
    });
  }

  clear() {
    this.matches.next([]);
  }
}
