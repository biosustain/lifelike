import { Component, Input } from '@angular/core';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { hslToRgb } from 'app/shared/utils/colors';

@Component({
  selector: 'app-project-icon',
  templateUrl: './project-icon.component.html',
  styleUrls: [
    './project-icon.component.scss',
  ],
})
export class ProjectIconComponent {

  @Input() project: FilesystemObject;
  @Input() size = '24px';

  generateBackground() {
    return `rgb(100,100,100)`;
  }

}
