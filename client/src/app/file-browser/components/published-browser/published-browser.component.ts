import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BehaviorSubject, iif, Observable, of, Subscription } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';

import { filesystemObjectLoadingMock } from 'app/shared/mocks/loading/file';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { promiseOfOne } from 'app/shared/rxjs/to-promise';
import { AuthenticationService } from 'app/auth/services/authentication.service';

import { FilesystemObject } from '../../models/filesystem-object';
import { FilesystemObjectList } from '../../models/filesystem-object-list';
import { FilesystemService } from '../../services/filesystem.service';
import { ProjectActions } from '../../services/project-actions';
import { PublishService } from '../../services/publish.service';

@Component({
  selector: 'app-published-browser',
  templateUrl: './published-browser.component.html',
})
export class PublishedBrowserComponent implements OnInit, OnDestroy {
  readonly loadTask: BackgroundTask<string, FilesystemObjectList> = new BackgroundTask(
    (userHashId: string) => this.filesystemService.getPublished(userHashId)
  );

  searchText: string;
  readonly filter$: BehaviorSubject<(item: FilesystemObject) => boolean> = new BehaviorSubject(
    (item: FilesystemObject) => Boolean(item)
  );
  readonly listModel$: Observable<FilesystemObjectList> = this.loadTask.results$.pipe(
    map(({ result }) => result),
    switchMap((listModel) =>
      this.filter$.pipe(
        map((filter) => {
          listModel.results.setFilter(filter);
          return listModel;
        })
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  fileList: FilesystemObjectList = new FilesystemObjectList(
    mockArrayOf(filesystemObjectLoadingMock),
    {
      sort: (a, b) => b.updatedTimestamp - a.updatedTimestamp,
    }
  );

  private loadTaskSubscription: Subscription;

  constructor(
    private readonly filesystemService: FilesystemService,
    protected readonly projectActions: ProjectActions,
    protected readonly publishService: PublishService,
    private readonly activeRoute: ActivatedRoute,
    readonly authService: AuthenticationService
  ) {}

  readonly userHashId$ = this.activeRoute.params.pipe(
    switchMap((params) =>
      iif(
        () => params.user_hash_id !== undefined,
        of(params.user_hash_id),
        this.authService.appUser$.pipe(map((user) => user.hashId))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * Open a dialog to upload a file.
   * @param parent the folder to put the new file in
   */
  openPublishDialog(): Promise<FilesystemObject> {
    const object = new FilesystemObject();
    return promiseOfOne(this.userHashId$)
      .then((userHashId) =>
        this.publishService.openPublishDialog(
          object,
          {
            title: 'Publish',
            promptUpload: true,
            promptParent: false,
          },
          userHashId
        )
      )
      .then((result) => {
        if (result) {
          this.refresh();
        }
        return result;
      });
  }

  ngOnInit() {
    this.loadTaskSubscription = this.listModel$
      .pipe(switchMap(({ results: { view$ } }) => view$))
      .subscribe((files) => {
        this.fileList.collectionSize = files.length;
        this.fileList.results.replace(files);
      });

    this.userHashId$.subscribe((userHashId) => this.loadTask.update(userHashId));
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    return promiseOfOne(this.userHashId$).then((userHashId) => this.loadTask.update(userHashId));
  }

  applyFilter(filter: string) {
    const normalizedFilter = FilesystemObject.normalizeFilename(filter);
    this.filter$.next((item: FilesystemObject) =>
      FilesystemObject.normalizeFilename(item.effectiveName).includes(normalizedFilter)
    );
  }
}
