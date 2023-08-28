import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

export function promiseOfOne<V>(project: Observable<V>): Promise<V> {
  return project.pipe(take(1)).toPromise();
}
