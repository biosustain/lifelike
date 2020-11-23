import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { KnowledgeMap } from 'app/drawing-tool/services/interfaces';
import { FileNavigatorService } from 'app/file-navigator/services/file-navigator.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { CollectionModal } from 'app/shared/utils/collection-modal';
import { FilesystemObjectActions } from '../../../file-browser/services/filesystem-object-actions';
import { WorkspaceManager } from '../../../shared/workspace-manager';

@Component({
  selector: 'app-associated-maps',
  templateUrl: './associated-maps.component.html',
  styleUrls: ['./associated-maps.component.scss'],
})
export class AssociatedMapsComponent implements OnInit, OnDestroy {
  private loadTaskSubscription: Subscription;

  readonly loadTask: BackgroundTask<void, KnowledgeMap[]> = new BackgroundTask(
    () => this.fileNavigatorService.getAssociatedMaps(this.projectName, this.fileId),
  );

  readonly results = new CollectionModal<KnowledgeMap>([], {
    multipleSelection: true,
  });

  collectionSize: number;

  projectName: string;
  fileId: string;

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly fileNavigatorService: FileNavigatorService,
    protected readonly filesystemObjectActions: FilesystemObjectActions,
    protected readonly workspaceManager: WorkspaceManager,
  ) {
    this.projectName = this.route.snapshot.params.project_name;
    this.fileId = this.route.snapshot.params.file_id;

    this.collectionSize = 0;
  }

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

  createMap() {
    /*
    this.filesystemObjectActions.openMapCreateDialog(null).then(result => {
      this.workspaceManager.navigate([
        '/projects',
        result.project.project_name,
        'maps',
        result.project.hash_id,
        'edit',
      ], {
        newTab: true,
      });
    }, () => {
    });
     */
    // TODO
  }
}
