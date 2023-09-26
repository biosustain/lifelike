import { Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';

class MutationObservable extends Observable<MutationRecord[]> implements MutationObserver {
  private mutation$ = new Subject<MutationRecord[]>();
  private mutationObserver: MutationObserver = new MutationObserver((mutations) =>
    this.mutation$.next(mutations)
  );

  constructor() {
    super((observer) => {
      this.mutation$.subscribe(observer);
      return () => this.disconnect();
    });
  }

  disconnect(): void {
    this.mutationObserver.disconnect();
  }

  observe(target: Node, options?: MutationObserverInit): void {
    this.mutationObserver.observe(target, options);
  }

  takeRecords(): MutationRecord[] {
    return this.mutationObserver.takeRecords();
  }
}

export function createMutationObservable(records$: Observable<[Node, MutationObserverInit][]>) {
  return records$.pipe(
    switchMap((records) => {
      const observable = new MutationObservable();
      records.forEach(([target, options]) => observable.observe(target, options));
      return observable;
    })
  );
}
