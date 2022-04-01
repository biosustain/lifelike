import { Component, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Observable, ReplaySubject, forkJoin, iif, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, tap, switchMap, distinctUntilChanged, first } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { FilesystemObject } from '../models/filesystem-object';
import { ObjectVersionHistory } from '../models/object-version';
import { FilesystemService } from '../services/filesystem.service';

@Component({
  selector: 'app-object-version-history',
  templateUrl: './object-version-history.component.html',
  styleUrls: [
    './object-version-history.component.scss',
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: ObjectVersionHistoryComponent,
    multi: true,
  }],
})
export class ObjectVersionHistoryComponent implements ControlValueAccessor {

  page$ = new BehaviorSubject<number>(1);
  _limit$ = new BehaviorSubject<number>(20);
  limit$ = this._limit$.pipe(distinctUntilChanged());

  @Input() set limit(limit: number) {
    this._limit$.next(limit);
  }

  @Input() showCheckboxes = true;
  private changeCallback: any;
  private touchCallback: any;

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler) {
  }

  _object$ = new ReplaySubject<FilesystemObject>(1);
  object$ = this._object$.pipe(distinctUntilChanged());

  @Input() set object(object: FilesystemObject | undefined) {
    this._object$.next(object);
  }

  history$: Observable<ObjectVersionHistory> = combineLatest([
    this.object$,
    this.page$,
    this.limit$
  ]).pipe(
    switchMap(([{hashId}, page, limit]) =>
      this.filesystemService.getVersionHistory(hashId, {page, limit})
    ),
    tap(({results}) => {
      results.multipleSelection = false;
    })
  );

  log$: Observable<ObjectVersionHistory> = this.history$.pipe(
    switchMap(history =>
      history.results.selectionChanges$.pipe(
        switchMap(({added}) =>
          forkJoin(
            [...added].filter(({contentValue}) => !contentValue).map(version =>
              this.filesystemService.getVersionContent(version.hashId).pipe(
                this.errorHandler.create({label: 'Get object version content'}),
                tap(content => version.contentValue = content)
              )
            )
          )
        ),
        switchMap(() =>
          iif(
            () => this.changeCallback,
            history.results.lastSelection$.pipe(
              tap(lastSelection => this.changeCallback(lastSelection))
            ),
            of()
          )
        ),
        tap(() => this.touchCallback?.()),
        map(() => history)
      )
    ),
    this.errorHandler.create({label: 'Get object version history'})
  );

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value): void {
    this.history$.pipe(
      tap(history => {
        if (value != null) {
          history.results.select(value);
        } else {
          history.results.select();
        }
      }),
      first(),
    ).toPromise();
  }
}
