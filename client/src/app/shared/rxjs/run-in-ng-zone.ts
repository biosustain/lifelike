import { NgZone } from '@angular/core';

import { Observable } from 'rxjs';

export const runInNgZone =
  (ngZone: NgZone) =>
  <T>(source: Observable<T>) =>
    new Observable((observer) =>
      source.subscribe(
        (value) => ngZone.run(() => observer.next(value)),
        (error) => ngZone.run(() => observer.error(error)),
        () => ngZone.run(() => observer.complete())
      )
    );
