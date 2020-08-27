import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProjectSpaceService } from '../../services/project-space.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import { CollectionModal } from '../../../shared/utils/collection-modal';
import { MapService } from '../../../drawing-tool/services';
import { ResultList } from '../../../interfaces/shared.interface';
import { PublicMap } from '../../../drawing-tool/services/map.service';

@Component({
  selector: 'app-browser-community-list',
  templateUrl: './browser-community-list.component.html',
})
export class BrowserCommunityListComponent implements OnInit, OnDestroy {

  readonly loadTask: BackgroundTask<void, ResultList<PublicMap>> = new BackgroundTask(
    () => this.mapService.getCommunityMaps({
      sort: '-dateModified,+label',
      page: 1,
      limit: 3,
    }),
  );
  private loadTaskSubscription: Subscription;

  public collectionSize = 0;
  public readonly results = new CollectionModal<PublicMap>([], {
    multipleSelection: true,
  });

  constructor(private readonly projectSpaceService: ProjectSpaceService,
              private readonly mapService: MapService) {
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
