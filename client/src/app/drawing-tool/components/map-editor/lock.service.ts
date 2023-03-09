import { Injectable, NgZone, OnDestroy } from "@angular/core";

import {
  catchError,
  finalize,
  first,
  map,
  shareReplay,
  startWith,
  takeUntil,
} from "rxjs/operators";
import { fromEvent, merge, Subject, throwError } from "rxjs";

import { ObjectLock } from "app/file-browser/models/object-lock";
import { FilesystemService, LockError } from "app/file-browser/services/filesystem.service";
import { ErrorHandler } from "app/shared/services/error-handler.service";

@Injectable({
  providedIn: "***ARANGO_USERNAME***",
})
export class LockService implements OnDestroy {
  locator?: string;
  lockAcquired: boolean | undefined = null;
  locks: ObjectLock[] = [];
  private destroy$ = new Subject<any>();
  private lastActivityTime$ = this.ngZone.runOutsideAngular(() =>
    merge(fromEvent(window, "mousemove"), fromEvent(window, "keydown")).pipe(
      takeUntil(this.destroy$),
      startWith(),
      map(() => window.performance.now()),
      shareReplay(1)
    )
  );

  private readonly lockCheckTimeInterval = 1000 * 30;
  private readonly slowLockCheckTimeInterval = 1000 * 60 * 2;
  private readonly veryInactiveDuration = 1000 * 60 * 30;
  private readonly inactiveDuration = 1000 * 60 * 5;

  private lockIntervalId = null;
  private lockStartIntervalId = null;
  private lastLockCheckTime = window.performance.now();

  get lockCheckingActive(): boolean {
    return this.lockIntervalId != null || this.lockStartIntervalId != null;
  }

  constructor(
    private filesystemService: FilesystemService,
    private errorHandler: ErrorHandler,
    private ngZone: NgZone
  ) {
    // ensure we keep watching
    this.lastActivityTime$.subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.clearLockInterval();
  }

  acquireLock() {
    return this.lastActivityTime$
      .pipe(first())
      .toPromise()
      .then((lastActivityTime) => {
        const monotonicNow = window.performance.now();

        if (monotonicNow - lastActivityTime > this.veryInactiveDuration) {
          // If the user is inactive for too long, stop hitting our poor server
          this.clearLockInterval();
        } else if (monotonicNow - lastActivityTime > this.inactiveDuration) {
          // If the user is inactive for a bit, let's slow down the checking interval
          if (monotonicNow - this.lastLockCheckTime < this.slowLockCheckTimeInterval) {
            return;
          }
        }

        if (this.lockAcquired === false) {
          this.filesystemService
            .getLocks(this.locator)
            .pipe(finalize(() => (this.lastLockCheckTime = window.performance.now())))
            .subscribe((locks) => {
              this.locks = locks;
            });
        } else {
          this.filesystemService
            .acquireLock(this.locator)
            .pipe(
              finalize(() => (this.lastLockCheckTime = window.performance.now())),
              catchError((error) => {
                if (!(error instanceof LockError)) {
                  this.errorHandler.showError(error);
                }
                return throwError(error);
              })
            )
            .subscribe(
              (locks) => {
                this.lockAcquired = true;
                this.locks = locks;
              },
              (err: LockError) => {
                this.lockAcquired = false;
                this.locks = "locks" in err ? err.locks : [];
              }
            );
        }
      });
  }

  startLockInterval() {
    this.lockAcquired = null;

    // Make the timer start near the crossing of the second hand, to make it look like the
    // lock indication is live, even through we actually check infrequently
    this.lockStartIntervalId = setTimeout(() => {
      this.lockIntervalId = setInterval(this.acquireLock.bind(this), this.lockCheckTimeInterval);
    }, 60 - new Date().getSeconds() + 1);

    this.acquireLock();
  }

  clearLockInterval() {
    if (this.lockStartIntervalId != null) {
      clearInterval(this.lockStartIntervalId);
      this.lockStartIntervalId = null;
    }
    if (this.lockIntervalId != null) {
      clearInterval(this.lockIntervalId);
      this.lockIntervalId = null;
    }
  }
}
