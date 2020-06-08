import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter
} from '@angular/core';

import * as $ from 'jquery';

import { Action } from '../drawing-tool.component';
import { annotationTypes } from 'app/shared/annotation-styles';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss']
})
export class PaletteComponent implements OnInit {
  @Input() undoStack: Action[] = [];
  @Input() redoStack: Action[] = [];

  @Output() undo: EventEmitter<any> = new EventEmitter();
  @Output() redo: EventEmitter<any> = new EventEmitter();

  /** Build the palette ui with node templates defined */
  nodeTemplates = annotationTypes;

  constructor() { }

  ngOnInit() {

  }

  _undo() {
    if (this.undoStack.length) { this.undo.emit(); }
  }
  _redo() {
    if (this.redoStack.length) { this.redo.emit(); }
  }
}
