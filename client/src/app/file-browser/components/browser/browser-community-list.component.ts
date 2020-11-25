import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProjectSpaceService } from '../../services/project-space.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { from, Subscription } from 'rxjs';
import { CollectionModal } from '../../../shared/utils/collection-modal';
import { ResultList } from '../../../interfaces/shared.interface';
import { FilesystemObject } from '../../models/filesystem-object';

@Component({
  selector: 'app-browser-community-list',
  templateUrl: './browser-community-list.component.html',
})
export class BrowserCommunityListComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, ResultList<FilesystemObject>> = new BackgroundTask(
    () => from([]),
  );
  private loadTaskSubscription: Subscription;

  public collectionSize = 0;
  public readonly results = new CollectionModal<FilesystemObject>([], {
    multipleSelection: true,
  });

  constructor(private readonly projectSpaceService: ProjectSpaceService) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: maps}) => {
      this.collectionSize = maps.total;
      this.results.replace(maps.results);
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
