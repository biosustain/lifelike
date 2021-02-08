import { Component, Input } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-file-type-label',
  templateUrl: './object-type-label.component.html',
})
export class ObjectTypeLabelComponent {
  @Input() object: FilesystemObject;
  @Input() showLabel = true;
}
