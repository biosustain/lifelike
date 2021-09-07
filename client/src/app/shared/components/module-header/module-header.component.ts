import { Component, Input, EventEmitter, Output, TemplateRef } from '@angular/core';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { ActivatedRoute } from '@angular/router';

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
    protected readonly route: ActivatedRoute,
  ) {}

  openNewWindow() {
    const url = '/' + this.route.url.value.join('/');
    window.open(url);
  }
}
