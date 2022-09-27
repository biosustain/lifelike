import { Component, OnDestroy, OnInit } from '@angular/core';

import { isNil, partition } from 'lodash-es';
import { Subscription, combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { tap, map, switchMap, zip, shareReplay } from 'rxjs/operators';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { FilesystemObjectList } from '../models/filesystem-object-list';
import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';
import { ProjectList } from '../models/project-list';
import { ProjectActions } from '../services/project-actions';
import { ProjectsService } from '../services/projects.service';

@Component({
  selector: 'app-starred-browser',
  templateUrl: './starred-browser.component.html',
})
export class StarredBrowserComponent implements OnInit, OnDestroy {
  readonly loadTask: BackgroundTask<void, FilesystemObjectList> = new BackgroundTask(
    () => this.filesystemService.getStarred()
  );

  searchText: string;
  filter$: BehaviorSubject<(item: FilesystemObject) => boolean> = new BehaviorSubject((item: FilesystemObject) => !isNil(item.starred));
  listModel$: Observable<FilesystemObjectList> = this.loadTask.results$.pipe(
    map(({result}) => result),
    switchMap(listModel => this.filter$.pipe(
      map(filter => {
        listModel.results.setFilter(filter);
        return listModel;
      })
    )),
    shareReplay({bufferSize: 1, refCount: true})
  );
  fileList: FilesystemObjectList = new FilesystemObjectList();
  projectList: ProjectList = new ProjectList();

  private loadTaskSubscription: Subscription;

  constructor(
    private readonly filesystemService: FilesystemService,
    private readonly projectService: ProjectsService,
    protected readonly projectActions: ProjectActions
  ) {}

  ngOnInit() {
    this.loadTaskSubscription = this.listModel$.pipe(
      switchMap(({results: {view$}}) => view$)
    ).subscribe(list => {
      const [files, projectRoots] = partition(list, i => i.parent);
      this.fileList.collectionSize = files.length;
      this.fileList.results.replace(files);
      this.projectList.collectionSize = projectRoots.length;
      this.projectList.results.replace(projectRoots.map(r => r.project));
    });

    this.refresh();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update();
  }

  applyFilter(filter: string) {
    const normalizedFilter = FilesystemObject.normalizeFilename(filter);
    this.filter$.next((item: FilesystemObject) => !isNil(item.starred) && FilesystemObject.normalizeFilename(item.name).includes(normalizedFilter));
  }

  toggleStarred(project) {
    return this.projectActions.updateStarred(project, !project.starred).then(() => this.refresh());
  }
}
