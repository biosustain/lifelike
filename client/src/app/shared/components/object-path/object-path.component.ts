import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { getPath } from 'app/shared/utils/files';

@Component({
  selector: 'app-object-path',
  templateUrl: './object-path.component.html',
})
export class ObjectPathComponent implements OnChanges {
  @Input() object?: FilesystemObject;
  @Input() rootName = null;
  @Input() forEditing = true;
  path: FilesystemObject[] = [];
  @Input() newTab = false;
  @Output() refreshRequest = new EventEmitter<any>();
  @Input() wrap;

  constructor(protected readonly workspaceManager: WorkspaceManager) {
  }

  ngOnChanges({object}: SimpleChanges) {
    if (object?.currentValue) {
      this.path = getPath(object.currentValue);
    }
  }


  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(false), {
      newTab: true,
    });
  }
}
