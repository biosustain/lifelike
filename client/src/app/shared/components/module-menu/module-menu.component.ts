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
import { ClipboardService } from '../../services/clipboard.service';
import { ModuleContext } from '../../services/module-context.service';

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
              protected readonly clipboard: ClipboardService,
              private tabUrlService: ModuleContext
  ) {
    super(router, snackBar, errorHandler, route, workspaceManager, actions, objectTypeService);
  }

  async openShareDialog(target: FilesystemObject) {
    return await this.clipboard.copy(
      this.tabUrlService.shareableLink,
      {intermediate: 'Generating link...'}
    );
  }
}
