import { Observable, Subject, Subscriber } from 'rxjs';

class Intersection extends Observable<IntersectionObserverEntry[]> implements IntersectionObserver {
  constructor(
    private intersectionObserver: IntersectionObserver,
    private intersectionSubject: Subject<IntersectionObserverEntry[]>
  ) {
    super((observer) => {
      intersectionSubject.subscribe(observer);
      return () => {
        intersectionObserver.disconnect();
        intersectionSubject.complete();
      };
    });
  }

  get ***ARANGO_USERNAME***(): Element | null {
    return this.intersectionObserver.***ARANGO_USERNAME***;
  }

  get ***ARANGO_USERNAME***Margin(): string {
    return this.intersectionObserver.***ARANGO_USERNAME***Margin;
  }

  get thresholds(): ReadonlyArray<number> {
    return this.intersectionObserver.thresholds;
  }

  disconnect(): void {
    return this.intersectionObserver.disconnect();
  }

  observe(target: Element): void {
    return this.intersectionObserver.observe(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return this.intersectionObserver.takeRecords();
  }

  unobserve(target: Element): void {
    return this.intersectionObserver.unobserve(target);
  }
}

/**
 * Return observable which waits for browser beeing idle or timeout running out
 * @param timeout - in ms
 */
export function intersection(options?: IntersectionObserverInit): Intersection {
  const intersectionSubject = new Subject<IntersectionObserverEntry[]>();
  const intersectionObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => intersectionSubject.next(entries),
    options
  );
  return new Intersection(intersectionObserver, intersectionSubject);
}
