import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable, iif, of } from 'rxjs';
import { audit, filter } from 'rxjs/operators';

@Injectable()
export class SankeyUpdateService {
  get isDirty() {
    return this._isDirty$.value;
  }

  get isAwaited() {
    return this._waitingRefCount$.value > 0;
  }

  private _isDirty$ = new BehaviorSubject<boolean>(false);
  isDirty$ = this._isDirty$.asObservable();

  private _waitingRefCount$ = new BehaviorSubject<number>(0);
  waitingRefCount$ = this._waitingRefCount$.asObservable();

  cleanup$ = new Observable(subscriber => {
    this._waitingRefCount$.next(this._waitingRefCount$.value + 1);
    const subscribtion = this.isDirty$.pipe(
      filter(isDirty => !isDirty)
    ).subscribe(subscriber);
    return () => {
      this._waitingRefCount$.next(this._waitingRefCount$.value - 1);
      subscribtion.unsubscribe();
    };
  });

  modified(element, data) {
    this._isDirty$.next(true);
  }

  reset() {
    this._isDirty$.next(false);
  }
}
