import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';

import { CollectionModel } from 'app/shared/utils/collection-model';
import { WorkspaceNavigationExtras } from 'app/workspace/services/workspace-manager';

import { FilesystemObject } from '../models/filesystem-object';
import { ObjectListService } from '../services/object-list.service';

@Component({
  selector: 'app-object-list',
  templateUrl: './object-list.component.html',
  providers: [ObjectListService],
})
export class ObjectListComponent {
  constructor(readonly controller: ObjectListService) {}

  @Input() appLinks: boolean | WorkspaceNavigationExtras = false;
  @Input() forEditing = true;
  @Input() showStars = true;
  @Input() showDescription = false;
  @Input() parent: FilesystemObject | undefined;
  @Input() objects: CollectionModel<FilesystemObject> | undefined;
  @Input() objectControls = true;
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';
  @Output() refreshRequest: EventEmitter<string> = this.controller.refreshRequest;
  @Output() objectOpen: EventEmitter<FilesystemObject> = this.controller.objectOpen;
}
