import { Component, Input } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { CollectionModel } from '../../shared/utils/collection-model';

@Component({
  selector: 'app-directory-preview',
  templateUrl: './directory-preview.component.html',
})
export class DirectoryPreviewComponent {

  @Input() objects: CollectionModel<FilesystemObject> | undefined;

}
