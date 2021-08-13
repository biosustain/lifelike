import { Component, Input, EventEmitter, Output, TemplateRef } from '@angular/core';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';

@Component({
  selector: 'app-header',
  templateUrl: './unified-header.component.html',
  styleUrls: ['./unified-header.component.scss']
})
export class UnifiedHeaderComponent {
  @Input() object: FilesystemObject;
  @Input() header: TemplateRef<any>;
  @Input() titleTemplate: TemplateRef<any>;
  requestRefresh;
  returnUrl: string;
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
