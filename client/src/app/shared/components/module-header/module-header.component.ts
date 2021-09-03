import { Component, Input, EventEmitter, Output, TemplateRef } from '@angular/core';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';

@Component({
  selector: 'app-module-header',
  templateUrl: './module-header.component.html'
})
export class ModuleHeaderComponent {
  @Input() object!: FilesystemObject;
  @Input() titleTemplate: TemplateRef<any>;
  @Input() returnUrl: string;
  @Input() showObjectMenu = true;
  @Output() dragStarted = new EventEmitter();

  constructor(
    private readonly filesystemObjectActions: FilesystemObjectActions
  ) {}

  openNewWindow() {
    this.filesystemObjectActions.openNewWindow(this.object);
  }
}
