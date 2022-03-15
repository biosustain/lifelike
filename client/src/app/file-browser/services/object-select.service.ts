import { Injectable, OnDestroy } from '@angular/core';

import { from, Observable, Subscription, ReplaySubject } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';

import { PaginatedRequestOptions } from 'app/shared/schemas/common';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { ProjectList } from '../models/project-list';
import { ProjectsService } from './projects.service';

@Injectable()
export class ObjectSelectService implements OnDestroy {
  multipleSelection = false;
  objectFilter: (item: FilesystemObject) => boolean;

  hashId: string;
  object$: Observable<FilesystemObject> = from([]);
  object: FilesystemObject;

  private annotationSubscription: Subscription;

  readonly pagingProjectList$ = new ReplaySubject<PaginatedRequestOptions>(1);

  readonly projectList$: Observable<ProjectList> = this.pagingProjectList$.pipe(
    switchMap(options => this.projectService.list(options)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  constructor(private readonly projectService: ProjectsService,
              private readonly filesystemService: FilesystemService) {
  }

  ngOnDestroy(): void {
    if (this.annotationSubscription) {
      this.annotationSubscription.unsubscribe();
      this.annotationSubscription = null;
    }
  }

  private applyInput() {
    if (this.object != null) {
      this.object.children.multipleSelection = this.multipleSelection;
      this.object.children.filter = this.objectFilter;
    }
  }

  load(hashId: string): Observable<any> {
    this.hashId = hashId;
    this.object$ = from([]);
    this.object = null;

    if (hashId == null) {
      this.pagingProjectList$.next({
        sort: 'name',
        limit: 16,
        page: 1,
      });
      return this.projectList$;
    } else {
      const object$ = this.filesystemService.get(hashId).pipe(map(object => {
        if (this.annotationSubscription) {
          this.annotationSubscription.unsubscribe();
          this.annotationSubscription = null;
        }
        this.annotationSubscription = this.filesystemService.annotate(object);
        this.object = object;
        this.applyInput();
        return object;
      }));
      this.object$ = object$;
      return object$;
    }
  }

  open(target: FilesystemObject) {
    if (target.isDirectory) {
      this.load(target.hashId);
    }
  }

  goUp() {
    if (this.object != null && this.object.parent != null) {
      this.load(this.object.parent.hashId);
    } else {
      this.load(null);
    }
  }
}
