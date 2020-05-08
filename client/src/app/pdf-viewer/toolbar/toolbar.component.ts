import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
declare var jQuery: any;

interface ControlChanged {
  controlName;
  controlValue;
}

@Component({
  selector: 'app-pdf-viewer-lib-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

  // tslint:disable-next-line:no-output-on-prefix
  @Output() onControlChanged =  new EventEmitter();

  constructor() {
  }

  ngOnInit(): void {
  }

  refresh() {
  }

  zoomIn() {
    this.onControlChanged.emit('zoomin');
  }

  zoomOut() {
    this.onControlChanged.emit('zoomout');

  }
}
