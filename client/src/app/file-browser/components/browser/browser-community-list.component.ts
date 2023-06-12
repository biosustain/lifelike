import { Component, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { filesystemObjectLoadingMock } from 'app/shared/mocks/loading/file';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';

import { FilesystemObjectList } from '../../models/filesystem-object-list';
import { FilesystemService } from '../../services/filesystem.service';

@Component({
  selector: 'app-browser-community-list',
  templateUrl: './browser-community-list.component.html',
})
export class BrowserCommunityListComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, FilesystemObjectList> = new BackgroundTask(
    () => this.filesystemService.search({
      type: 'public',
      sort: '-creationDate',
    }),
  );
  private loadTaskSubscription: Subscription;

  list: FilesystemObjectList = new FilesystemObjectList(mockArrayOf(filesystemObjectLoadingMock));

  constructor(protected readonly filesystemService: FilesystemService) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: list}) => {
      this.list = list;
    });

    this.refresh();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update();
  }
}
