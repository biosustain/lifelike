import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-file-info',
  templateUrl: './file-info.component.html',
})
export class FileInfoComponent {
  @Input() object: DirectoryObject | undefined;
  @Output() objectEdit = new EventEmitter<DirectoryObject>();
}
