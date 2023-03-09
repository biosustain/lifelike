import { Component, Input } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { BehaviorSubject, combineLatest, forkJoin, iif, Observable, of, ReplaySubject } from "rxjs";
import {
  defaultIfEmpty,
  distinctUntilChanged,
  first,
  map,
  shareReplay,
  switchMap,
  tap,
} from "rxjs/operators";

import { ErrorHandler } from "app/shared/services/error-handler.service";

import { FilesystemObject } from "../models/filesystem-object";
import { ObjectVersionHistory } from "../models/object-version";
import { FilesystemService } from "../services/filesystem.service";

@Component({
  selector: "app-object-version-history",
  templateUrl: "./object-version-history.component.html",
  styleUrls: ["./object-version-history.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: ObjectVersionHistoryComponent,
      multi: true,
    },
  ],
})
export class ObjectVersionHistoryComponent implements ControlValueAccessor {
  page$ = new BehaviorSubject<number>(1);
  _limit$ = new BehaviorSubject<number>(20);
  limit$ = this._limit$.pipe(distinctUntilChanged());
  @Input() showCheckboxes = true;
  _object$ = new ReplaySubject<FilesystemObject>(1);
  object$ = this._object$.pipe(distinctUntilChanged());
  // TODO: This is called twice with same parameters, resulting in 2 API calls.
  history$: Observable<ObjectVersionHistory> = combineLatest([
    this.object$,
    this.page$,
    this.limit$,
  ]).pipe(
    switchMap(([{ hashId }, page, limit]) =>
      this.filesystemService.getVersionHistory(hashId, { page, limit })
    ),
    tap(({ results }) => {
      results.multipleSelection = false;
    }),
    // TODO: This is a quick fix so it would not call the API twice. Find why we subscribe twice and fix that instead of sharing.
    shareReplay(1)
  );
  private changeCallback: any;
  private touchCallback: any;
  log$: Observable<ObjectVersionHistory> = this.history$.pipe(
    switchMap((history) =>
      // Subscribes to change of selections in the versions list, in order to lazy load the content of selected entry.
      history.results.selectionChanges$.pipe(
        switchMap(({ added }) =>
          forkJoin(
            // If the new selection does not have it's content loaded, query its content and update with tap.
            [...added]
              .filter(({ contentValue }) => !contentValue)
              .map((version) =>
                this.filesystemService.getVersionContent(version.hashId).pipe(
                  this.errorHandler.create({ label: "Get object version content" }),
                  tap((content) => (version.contentValue = content))
                )
              )
            // This pipe will be blocked until the first selectionChanges fires - which cannot happen without executing the pipe at least oce
            // Therefore we need to fire a default value first
          ).pipe(defaultIfEmpty(null))
        ),
        // Call change callback if present
        switchMap(() =>
          iif(
            () => this.changeCallback,
            history.results.lastSelection$.pipe(
              tap((lastSelection) => this.changeCallback(lastSelection))
            ),
            of()
          )
        ),
        // Call touch callback if present
        tap(() => this.touchCallback?.()),
        // Finally, return the history object
        map(() => history)
      )
    ),
    this.errorHandler.create({ label: "Get object version history" })
  );

  @Input() set limit(limit: number) {
    this._limit$.next(limit);
  }

  @Input() set object(object: FilesystemObject | undefined) {
    this._object$.next(object);
  }

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly errorHandler: ErrorHandler
  ) {}

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value): void {
    this.history$
      .pipe(
        tap((history) => {
          if (value != null) {
            history.results.select(value);
          } else {
            history.results.select();
          }
        }),
        first()
      )
      .toPromise();
  }
}
