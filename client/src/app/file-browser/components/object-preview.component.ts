import { Component, Input } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'app-object-preview',
  templateUrl: './object-preview.component.html',
})
export class ObjectPreviewComponent {

  _object?: FilesystemObject;
  objectWithContent?: FilesystemObject;

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler) {
  }

  @Input()
  set object(value: FilesystemObject | undefined) {
    if (value) {
      if (this._object !== value) {
        if (value.contentValue) {
          this.objectWithContent = value;
        } else {
          this.filesystemService.getContent(value.hashId)
            .pipe(
              this.errorHandler.create(),
            )
            .subscribe(content => {
              // @ts-ignore
              this.objectWithContent = cloneDeep(value);
              this.objectWithContent.contentValue = content;
            });
        }
      } else {
        this.objectWithContent = null;
      }
    }

    this._object = value;
  }

  get object() {
    return this._object;
  }

}
