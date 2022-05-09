import { AfterViewInit, Component, OnChanges, } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { get } from 'lodash-es';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ViewService } from 'app/file-browser/services/view.service';

import { ObjectMenuComponent } from '../object-menu/object-menu.component';
import { ModuleAwareComponent } from '../../modules';
import { ClipboardService } from '../../services/clipboard.service';

/**
 * app-object-menu in module context
 */
@Component({
  selector: 'app-module-menu',
  templateUrl: '../object-menu/object-menu.component.html',
})
export class ModuleMenuComponent extends ObjectMenuComponent implements AfterViewInit, OnChanges {
  constructor(readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly viewService: ViewService,
              protected readonly clipboard: ClipboardService
  ) {
    super(router, snackBar, errorHandler, route, workspaceManager, actions, objectTypeService);
  }

  async openShareDialog(target: FilesystemObject) {
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
      const {contexts} = this.router.***ARANGO_USERNAME***Contexts;
      componentInstance = get(contexts.get('primary'), 'outlet.component');
    }
    return this.clipboard.copy(
      this.viewService.getShareableLink(componentInstance, url).toPromise().then(({href}) => href),
      {intermediate: 'Generating link...'}
    );
  }
}
