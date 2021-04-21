import { Component, ElementRef, Input } from '@angular/core';
import { ObjectListComponent } from './object-list.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { FilesystemService } from '../services/filesystem.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { element } from 'protractor';
import { FilesystemObject, ProjectImpl } from '../models/filesystem-object';

@Component({
  selector: 'app-object-tile-deck',
  templateUrl: './object-tile-deck.component.html',
})
export class ObjectTileDeckComponent extends ObjectListComponent {

  @Input() tileDeckSize = 'md';
  @Input() newTabObject = false;
  @Input() newTabMore = false;
  @Input() showMoreButton = false;
  @Input() moreLink = [];
  @Input() moreButtonText = 'View more...';

  constructor(router: Router,
              snackBar: MatSnackBar,
              modalService: NgbModal,
              errorHandler: ErrorHandler,
              route: ActivatedRoute,
              workspaceManager: WorkspaceManager,
              actions: FilesystemObjectActions,
              filesystemService: FilesystemService,
              elementRef: ElementRef,
              progressDialog: ProgressDialog) {
    super(router, snackBar, modalService, errorHandler, route, workspaceManager, actions, filesystemService, elementRef, progressDialog);
  }

  objectDragStart(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);
  }

}
