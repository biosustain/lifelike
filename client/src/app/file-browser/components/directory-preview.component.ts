import { Component, Input } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { CollectionModal } from '../../shared/utils/collection-modal';

@Component({
  selector: 'app-directory-preview',
  templateUrl: './directory-preview.component.html',
})
export class DirectoryPreviewComponent {

  @Input() objects: CollectionModal<FilesystemObject> | undefined;

}
