import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter
} from '@angular/core';

import * as $ from 'jquery';

import {
  nodeTemplates
} from '../../services';
import { Action } from '../drawing-tool.component';

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

  paletteMode = 1;

  /** Build the palette ui with node templates defined */
  nodeTemplates = nodeTemplates;

  constructor() { }

  ngOnInit() {

  }

  _undo() {
    if (this.undoStack.length) { this.undo.emit(); }
  }
  _redo() {
    if (this.redoStack.length) { this.redo.emit(); }
  }

  changeSize() {
    switch (this.paletteMode) {
      case 0:
        $('#palette-panel').animate({
          height: '20rem'
        }, 500, () => {
          this.paletteMode = 1;
        });
        break;
      case 1:
        $('#palette-panel').animate({
          height: '36rem'
        }, 500, () => {
          this.paletteMode = 2;
        });
        break;
      case 2:
        $('#palette-panel').animate({
          height: '52px'
        }, 500, () => {
          this.paletteMode = 0;
        });
        break;
      default:
        break;
    }
  }
}
