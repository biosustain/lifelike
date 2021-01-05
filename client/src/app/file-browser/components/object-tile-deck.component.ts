import {Component, Input} from '@angular/core';
import {ObjectListComponent} from './object-list.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {FilesystemObjectActions} from '../services/filesystem-object-actions';
import {ActivatedRoute, Router} from '@angular/router';
import {WorkspaceManager} from '../../shared/workspace-manager';
import {ErrorHandler} from '../../shared/services/error-handler.service';

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
              actions: FilesystemObjectActions) {
    super(router, snackBar, modalService, errorHandler, route, workspaceManager, actions);
  }

}
