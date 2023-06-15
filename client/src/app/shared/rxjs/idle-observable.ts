import { Observable } from 'rxjs';

/**
 * Return single value observable which waits for browser beeing idle or timeout running out
 * @param timeout - in ms
 */
export function idle(idleRequestOptions = { timeout: 100 }) {
  return new Observable((observer) => {
    if ((window as any).requestIdleCallback) {
      const handle = (window as any).requestIdleCallback(() => {
        observer.next();
        observer.complete();
      }, idleRequestOptions);
      return (window as any).cancelIdleCallback(handle);
    }
    observer.next();
    observer.complete();
  });
}
