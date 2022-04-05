import { Injectable } from '@angular/core';

import { iif, BehaviorSubject, of, Observable, ReplaySubject } from 'rxjs';
import { switchMap, tap, first, shareReplay } from 'rxjs/operators';

import { PaginatedRequestOptions } from 'app/shared/schemas/common';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { ProjectsService } from './projects.service';
import { ProjectList } from '../models/project-list';

@Injectable()
export class ObjectSelectService {

  readonly pagingProjectList$ = new ReplaySubject<PaginatedRequestOptions>(1);

  readonly projectList$: Observable<ProjectList> = this.pagingProjectList$.pipe(
    switchMap(options => this.projectService.list(options)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  constructor(private readonly projectService: ProjectsService,
              private readonly filesystemService: FilesystemService) {
  }

  multipleSelection = false;
  objectFilter: (item: FilesystemObject) => boolean;

  hashId$ = new BehaviorSubject<string>(null);

  object$ = this.hashId$.pipe(
    switchMap(hashId =>
      iif(
        () => hashId == null,
        of({}).pipe(
          tap(() => this.pagingProjectList$.next({
            sort: 'name',
            limit: 16,
            page: 1,
          })),
          switchMap(() => this.projectList$)
        ),
        this.filesystemService.get(hashId).pipe(
          tap(object => this.applyInput(object))
        )
      )
    )
  );

  load(hashId: string) {
    this.hashId$.next(hashId);
  }

  private applyInput(object: FilesystemObject) {
    if (object != null) {
      object.children.multipleSelection = this.multipleSelection;
      object.children.setFilter(this.objectFilter);
    }
  }

  open(target: FilesystemObject) {
    if (target.isDirectory) {
      this.hashId$.next(target.hashId);
    }
  }

  goUp() {
    return this.object$.pipe(
      first(),
      tap(object => this.hashId$.next((object as FilesystemObject)?.parent?.hashId))
    ).toPromise();
  }
}
