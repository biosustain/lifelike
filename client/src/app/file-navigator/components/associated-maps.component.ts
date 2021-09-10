import { Component, Input, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObjectList } from '../../file-browser/models/filesystem-object-list';
import { FilesystemObject} from '../../file-browser/models/filesystem-object';
import {
  CreateActionOptions,
  ObjectTypeService,
} from '../../file-browser/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { tap } from 'rxjs/operators';
import {MimeTypes} from '../../shared/constants';

@Component({
  selector: 'app-associated-maps',
  templateUrl: './associated-maps.component.html',
})
export class AssociatedMapsComponent implements OnInit, OnDestroy {
  @Input() object: FilesystemObject;

  private loadTaskSubscription: Subscription;

  readonly loadTask: BackgroundTask<string, FilesystemObjectList> = new BackgroundTask(
    hashId => this.filesystemService.search({
      type: 'linked',
      linkedHashId: hashId,
      mimeTypes: ['vnd.***ARANGO_DB_NAME***.document/map'],
    }),
  );

  hashId: string;
  list: FilesystemObjectList;

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly filesystemObjectActions: FilesystemObjectActions,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly errorHandler: ErrorHandler) {
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
    this.loadTask.update(this.object.hashId);
  }

  openMapCreateDialog() {
    const options: CreateActionOptions = {
      parent: this.object.parent,
      createDialog: {
        promptParent: true,
      },
    };

    const testMap = new FilesystemObject();
    testMap.mimeType = MimeTypes.Map;
    this.objectTypeService.get(testMap).pipe(
      tap(provider => provider.getCreateDialogOptions()[0].item.create(options).then(
        object => this.workspaceManager.navigate(object.getCommands(), {
          newTab: true,
        }),
        () => {
        },
      )),
      this.errorHandler.create({label: 'Create map'}),
    ).subscribe();
  }
}
