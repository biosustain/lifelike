import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObjectList } from '../../file-browser/models/filesystem-object-list';

@Component({
  selector: 'app-associated-maps',
  templateUrl: './associated-maps.component.html',
})
export class AssociatedMapsComponent implements OnInit, OnDestroy {
  private loadTaskSubscription: Subscription;

  readonly loadTask: BackgroundTask<string, FilesystemObjectList> = new BackgroundTask(
    hashId => this.filesystemService.search({
      type: 'linked',
      linkedHashId: hashId,
      mimeTypes: ['vnd.lifelike.document/map'],
    }),
  );

  hashId: string;
  list: FilesystemObjectList;

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly filesystemService: FilesystemService,
    protected readonly filesystemObjectActions: FilesystemObjectActions,
    protected readonly workspaceManager: WorkspaceManager,
  ) {
    this.hashId = this.route.snapshot.params.file_id;
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
    this.loadTask.update(this.hashId);
  }

  createMap() {
    /*
    const parent = new FilesystemObject();
    parent.locator = {
      projectName: this.file.project_name,
      directoryId: this.file.dir_id,
    };
    parent.directory = {
      id: this.file.dir_id,
      projectsId: null,
      directoryParentId: null,
    };
    this.filesystemObjectActions.openMapCreateDialog(parent).then(result => {
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
