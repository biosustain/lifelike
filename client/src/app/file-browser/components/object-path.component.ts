import { Component, Input } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-object-path',
  templateUrl: './object-path.component.html',
})
export class ObjectPathComponent {

  @Input() rootName = null;
  @Input() forEditing = true;
  _object: FilesystemObject | undefined;
  path: FilesystemObject[] = [];
  @Input() newTab = false;

  @Input()
  set object(object: FilesystemObject | undefined) {
    this._object = object;
    this.path = this.getPath(object);
  }

  private getPath(object: FilesystemObject | undefined): FilesystemObject[] {
    let current = object;
    const path = [];
    while (current != null) {
      path.push(current);
      current = current.parent;
    }
    return path.reverse();
  }

}
