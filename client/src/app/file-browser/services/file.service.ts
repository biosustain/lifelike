import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subject, combineLatest, throwError, BehaviorSubject } from 'rxjs';
import { takeUntil, tap, startWith, map, switchMap, shareReplay, catchError, finalize } from 'rxjs/operators';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { addStatus } from 'app/shared/pipes/add-status.pipe';

import { FilesystemService } from './filesystem.service';

@Injectable()
export class FileService {
  private destroyed = new Subject();
  private loadTask = this.route.params.pipe(
    map(({hash_id}) => ({
      object$: this.filesystemService.get(hash_id),
      content$: this.filesystemService.getContent(hash_id)
    }))
  );
  private contentError = new BehaviorSubject<Error>(undefined);


  object$ = this.loadTask.pipe(
    switchMap(({object$}) => object$),
    shareReplay({refCount: true, bufferSize: 1})
  );

  status$ = this.object$.pipe(
    addStatus,
    switchMap(status => this.contentError.pipe(
      map(contentError => ({
        ...status,
        error: contentError ?? status.error
      }))
    ))
  );

  content$ = this.loadTask.pipe(
    switchMap(({content$}) => content$.pipe(
      tap({
        error(err) {
          this.contentError.next(err);
        },
        complete() {
          this.contentError.next(undefined);
        }
      })
    ))
  );

  contentBuffer$ = this.content$.pipe(
    mapBlobToBuffer()
  );

  contentJSON$ = this.contentBuffer$.pipe(
    mapBufferToJson()
  );

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly filesystemService: FilesystemService,
  ) {
    console.log("init file service");
  }
}
