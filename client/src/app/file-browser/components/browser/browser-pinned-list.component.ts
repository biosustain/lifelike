import { Component, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { FilesystemObjectList } from 'app/file-browser/models/filesystem-object-list';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';


@Component({
  selector: 'app-browser-pinned-list',
  templateUrl: './browser-pinned-list.component.html',
})
export class BrowserPinnedListComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, FilesystemObjectList> = new BackgroundTask(
    () => this.filesystemService.search({
      type: 'pinned',
      sort: '-modificationDate',
    }),
  );
  private loadTaskSubscription: Subscription;

  list: FilesystemObjectList = new FilesystemObjectList();

  constructor(protected readonly filesystemService: FilesystemService) {}

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
