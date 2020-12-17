import {Component, Input} from '@angular/core';
import {DirectoryObject} from '../../interfaces/projects.interface';

@Component({
  selector: 'app-file-type-label',
  templateUrl: './object-type-label.component.html',
})
export class ObjectTypeLabelComponent {
  @Input() object: DirectoryObject;
}
