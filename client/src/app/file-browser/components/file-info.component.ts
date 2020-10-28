import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';

@Component({
  selector: 'app-file-info',
  templateUrl: './file-info.component.html',
})
export class FileInfoComponent implements OnInit {
  @Input() defaultHighlightLimit = 5;
  highlightLimit = this.defaultHighlightLimit;
  @Input() highlightTerms: string[] | undefined;
  @Output() objectEdit = new EventEmitter<DirectoryObject>();
  @Output() highlightClick = new EventEmitter<string>();
  @Output() highlightDisplayLimitChange = new EventEmitter<HighlightDisplayLimitChange>();
  _object: DirectoryObject | undefined;

  @Input()
  set object(object: DirectoryObject | undefined) {
    this._object = object;
    this.highlightLimit = this.defaultHighlightLimit;
    this.highlightDisplayLimitChange.emit({
      previous: 0,
      limit: Math.min(this.highlightLimit,
        this._object.highlight != null ? this._object.highlight.length : 0),
    });
  }

  ngOnInit() {
    this.highlightDisplayLimitChange.emit({
      previous: 0,
      limit: Math.min(this.highlightLimit,
          this._object.highlight != null ? this._object.highlight.length : 0),
    });
  }

  get shownHighlights() {
    return this._object.highlight.slice(0, this.highlightLimit);
  }

  get reachedHighlightLimit() {
    return this.highlightLimit >= this._object.highlight.length;
  }

  displayMoreHighlights() {
    const previous = this.highlightLimit;
    this.highlightLimit = Math.min(this._object.highlight.length, this.highlightLimit + 5);
    this.highlightDisplayLimitChange.emit({
      previous,
      limit: Math.min(this.highlightLimit,
          this._object.highlight != null ? this._object.highlight.length : 0),
    });
  }
}

export interface HighlightDisplayLimitChange {
  previous: number;
  limit: number;
}
