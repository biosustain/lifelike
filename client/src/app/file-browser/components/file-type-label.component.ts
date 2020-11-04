import { Component, Input } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-file-type-label',
  templateUrl: './file-type-label.component.html',
})
export class FileTypeLabelComponent {
  @Input() object: DirectoryObject;
}
