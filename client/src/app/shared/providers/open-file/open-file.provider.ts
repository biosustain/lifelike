import { Injectable } from '@angular/core';

import { Observable, of, ReplaySubject } from 'rxjs';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

@Injectable()
export class OpenFileProvider {
  private readonly object$$ = new ReplaySubject<Observable<FilesystemObject>>(1);
  private readonly _object$ = this.object$$.pipe(
    switchMap((object$) => object$),
    switchMap((object) =>
      object.changed$.pipe(
        // react to changes in the object
        startWith(undefined),
        map(() => object)
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  set object(object: FilesystemObject) {
    this.object$$.next(of(object));
  }

  set object$(object$: Observable<FilesystemObject>) {
    this.object$$.next(object$);
  }

  get object$() {
    return this._object$;
  }
}
