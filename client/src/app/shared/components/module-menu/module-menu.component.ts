import { Component, OnChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { AuthenticationService } from 'app/auth/services/authentication.service';

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
export class ModuleMenuComponent extends ObjectMenuComponent implements OnChanges {
  constructor(
    readonly router: Router,
    protected readonly snackBar: MatSnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly actions: FilesystemObjectActions,
    protected readonly objectTypeService: ObjectTypeService,
    readonly authService: AuthenticationService,
    protected readonly clipboard: ClipboardService,
    private tabUrlService: ModuleContext
  ) {
    super(
      router,
      snackBar,
      errorHandler,
      route,
      workspaceManager,
      actions,
      objectTypeService,
      authService
    );
  }

  async openShareDialog(target: FilesystemObject) {
    return await this.clipboard.copy(this.tabUrlService.shareableLink, {
      intermediate: 'Generating link...',
    });
  }
}
