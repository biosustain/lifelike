import { Component, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { FilesystemObjectList } from '../models/filesystem-object-list';
import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject, normalizeFilename } from '../models/filesystem-object';

@Component({
  selector: 'app-starred-browser',
  templateUrl: './starred-browser.component.html',
})
export class StarredBrowserComponent implements OnInit, OnDestroy {
  readonly loadTask: BackgroundTask<void, FilesystemObjectList> = new BackgroundTask(
    () => this.filesystemService.getStarred()
  );

  searchText: string;
  list: FilesystemObjectList = new FilesystemObjectList();

  private loadTaskSubscription: Subscription;

  constructor(
    private readonly filesystemService: FilesystemService
  ) {}

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

  applyFilter(filter: string) {
    const normalizedFilter = normalizeFilename(filter);
    this.list.results.setFilter((item: FilesystemObject) => normalizeFilename(item.name).includes(normalizedFilter));
  }
}
