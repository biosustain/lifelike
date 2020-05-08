import { EMPTY, Observable, Subject } from 'rxjs';
import { finalize, map, mergeMap } from 'rxjs/operators';

/**
 * Manages the lifecycle of a task (such as a HTTP request), ensuring that only one request is
 * ongoing at any time. If a new request rolls it before the first one finishes, we simply queue
 * up another call that will execute when ready with the latest version of the request.
 */
export class BackgroundTask<T, R> {
  public observable: Observable<[R, T]>;
  public valueLoading: T = null;
  private currentValue = null;
  private refreshObservable = new Subject<boolean>();
  private initialRunFinalized = false;
  private runOngoing = false;
  private runPending = false;

  constructor(project: (value: T) => Observable<R>,
              private reducer: (accumulator: T, currentValue: T) => T = (accumulator, currentValue) => accumulator) {
    this.observable = this.refreshObservable
      .pipe(
        mergeMap(() => {
          if (this.runOngoing) {
            this.runPending = true;
            return EMPTY;
          } else {
            this.runOngoing = true;
            const currentValue = this.currentValue;
            this.currentValue = null;
            this.valueLoading = currentValue;
            return project(currentValue)
              .pipe(
                map(result => {
                  const combinedResult: [R, T] = [result, currentValue];
                  return combinedResult;
                }),
                finalize(() => {
                  this.runOngoing = false;
                  this.initialRunFinalized = true;
                  if (this.runPending) {
                    this.runPending = false;
                    this.refreshObservable.next(true);
                  }
                })
              );
          }
        })
      );
  }

  get loaded() {
    return this.initialRunFinalized;
  }

  get running() {
    return this.runOngoing;
  }

  update(value: T = null) {
    this.currentValue = this.reducer(value, this.currentValue);
    this.refreshObservable.next(true);
  }
}
