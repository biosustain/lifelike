import { OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Observable, Subject } from 'rxjs';
import { map, mergeMap, scan, shareReplay } from 'rxjs/operators';

import { BackgroundTask } from '../../rxjs/background-task';
import { ResultList, ResultQuery } from '../../schemas/common';
import { CollectionModel } from '../../utils/collection-model';
import { WorkspaceManager } from '../../workspace-manager';

export abstract class ResultListComponent<O, R, RL extends ResultList<R> = ResultList<R>>
  implements OnInit, OnDestroy
{
  public readonly loadTask: BackgroundTask<O, RL> = new BackgroundTask((params) =>
    this.getResults(params)
  );

  public readonly params$ = this.route.queryParams.pipe(
    mergeMap((params) => this.deserializeParams(params))
  );

  protected readonly resultList$ = this.loadTask.results$.pipe(
    map(({ result }) => result),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly loadedResults$ = this.resultList$.pipe(
    scan(
      (model, { results }: RL) => {
        model.replace(results);
        return model;
      },
      new CollectionModel<R>([], {
        multipleSelection: true,
      })
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  public readonly collectionSize$ = this.resultList$.pipe(map(({ total }) => total));
  public readonly resultQuery$: Observable<ResultQuery> = this.resultList$.pipe(
    map(({ query }) => query)
  );
  protected readonly destroy$ = new Subject();

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager
  ) {}

  ngOnInit() {
    // This cannot be placed in constructor since when inherited subclass has not been initialised yet
    this.params$.subscribe((params) => {
      if (this.valid) {
        this.loadTask.update(params);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh() {
    return this.params$.toPromise().then((params) => this.loadTask.update(params));
  }

  search(params: Partial<O>) {
    this.workspaceManager.navigate(
      this.route.snapshot.url.map((item) => item.path),
      {
        queryParams: {
          ...this.serializeParams(
            {
              ...this.getDefaultParams(),
              ...params,
            },
            true
          ),
          t: new Date().getTime(),
        },
      }
    );
  }

  get valid(): boolean {
    return true;
  }

  abstract getResults(params: O): Observable<RL>;

  abstract getDefaultParams(): O;

  abstract deserializeParams(params: { [key: string]: string }): Observable<O>;

  abstract serializeParams(params: O, restartPagination: boolean): Partial<Record<keyof O, string>>;
}
