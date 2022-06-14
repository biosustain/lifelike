import { Component, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObjectList } from 'app/file-browser/models/filesystem-object-list';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { RecentFilesService } from '../../services/recent-files.service';

@Component({
  selector: 'app-browser-recent-list',
  templateUrl: './browser-recent-list.component.html',
})
export class BrowserRecentListComponent implements OnInit, OnDestroy {
  readonly loadTask: BackgroundTask<void, FilesystemObjectList> = new BackgroundTask(
    () => this.recentFilesService.list.pipe(
      map(data => {
        const list = new FilesystemObjectList();
        list.results.replace(data);
        return list;
      }),
    )
  );
  private loadTaskSubscription: Subscription;

  list: FilesystemObjectList = new FilesystemObjectList();

  constructor(protected readonly recentFilesService: RecentFilesService) {}

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
