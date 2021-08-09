import { Component, Input, EventEmitter, Output } from '@angular/core';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { TaskStatus } from '../../rxjs/background-task';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';

@Component({
  selector: 'app-tab',
  templateUrl: './tab.component.html',
  styleUrls: ['./tab.component.scss']
})
export class TabComponent {
  @Input() status: TaskStatus;
  @Input() object: FilesystemObject;
  requestRefresh;
  returnUrl: string;
  title: string;
  @Output() dragStarted: EventEmitter<any>;

  constructor(
    private readonly filesystemObjectActions: FilesystemObjectActions
  ) {
    this.dragStarted = new EventEmitter();
  }

  openNewWindow() {
    this.filesystemObjectActions.openNewWindow(this.object);
  }
}
