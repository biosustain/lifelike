import { Component, Input, EventEmitter, Output, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ModuleAwareComponent } from '../../modules';
import { get } from 'lodash-es';
import { ViewService } from '../../../file-browser/services/view.service';
import { WorkspaceManager } from '../../workspace-manager';

@Component({
  selector: 'app-module-header',
  templateUrl: './module-header.component.html'
})
export class ModuleHeaderComponent {
  @Input() object!: FilesystemObject;
  @Input() titleTemplate: TemplateRef<any>;
  @Input() returnUrl: string;
  @Input() showObjectMenu = true;
  @Input() showBreadCrumbs = true;
  @Input() showNewWindowButton = true;
  @Output() dragStarted = new EventEmitter();

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly viewService: ViewService,
    protected readonly workspaceManager: WorkspaceManager,
    readonly router: Router,
  ) {
  }

  openNewWindow() {
    let url;
    let componentInstance: ModuleAwareComponent;
    const {focusedPane} = this.workspaceManager;
    if (focusedPane) {
      const {activeTab} = focusedPane;
      url = activeTab.url;
      componentInstance = activeTab.getComponent();
    } else {
      // in case of primary outlet
      url = this.router.url;
      // @ts-ignore
      const {contexts} = this.router.rootContexts;
      componentInstance = get(contexts.get('primary'), 'outlet.component');
    }
    return this.viewService.getShareableLink(componentInstance, url).toPromise().then(({href}) => window.open(href));
  }
}
