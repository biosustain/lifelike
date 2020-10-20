import { Component, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { KnowledgeMap } from 'app/drawing-tool/services/interfaces';
import { FileNavigatorService } from 'app/file-navigator/services/file-navigator.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { CollectionModal } from 'app/shared/utils/collection-modal';

@Component({
  selector: 'app-associated-maps',
  templateUrl: './associated-maps.component.html',
  styleUrls: ['./associated-maps.component.scss']
})
export class AssociatedMapsComponent implements OnInit, OnDestroy {
  public readonly loadTask: BackgroundTask<void, KnowledgeMap[]> = new BackgroundTask(
    // TODO: This is temp, need to get the actual project name and file id
    () => this.fileNavigatorService.getAssociatedMaps('Example', '7d131591-f156-4de3-90bb-49f9352d7c2a'),
  );

  public collectionSize = 0;
  public readonly results = new CollectionModal<KnowledgeMap>([], {
    multipleSelection: true,
  });

  private loadTaskSubscription: Subscription;

  constructor(private readonly fileNavigatorService: FileNavigatorService) {}

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: maps}) => {
      this.collectionSize = maps.length;
      this.results.replace(maps);
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
