import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-file-info',
  templateUrl: './file-info.component.html',
})
export class FileInfoComponent {
  @Input() object: DirectoryObject | undefined;
  @Output() objectEdit = new EventEmitter<DirectoryObject>();
  highlightLimit = 5;

  get shownHighlights() {
    return this.object.highlight.slice(0, this.highlightLimit);
  }

  get reachedHighlightLimit() {
    return this.highlightLimit >= this.object.highlight.length;
  }

  displayMoreHighlights() {
    this.highlightLimit += 5;
  }
}
