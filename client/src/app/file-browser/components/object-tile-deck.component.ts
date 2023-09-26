import {
  Component,
  ElementRef,
  Input,
  TemplateRef,
  ContentChild,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { ObjectListComponent } from './object-list.component';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';
import { ObjectListService } from '../services/object-list.service';

@Component({
  selector: 'app-object-tile-deck',
  templateUrl: './object-tile-deck.component.html',
  providers: [ObjectListService],
})
export class ObjectTileDeckComponent extends ObjectListComponent {
  @Input() tileDeckSize = 'md';
  @Input() newTabObject = false;
  @Input() newTabMore = false;
  @Input() showMoreButton = false;
  @Input() showAuthor = true;
  @Input() moreLink = [];
  @Input() moreButtonText = 'View more...';
  @ContentChild('tileToolbar', { static: false }) tileToolbar: TemplateRef<any>;
}
