import { Component, Input} from '@angular/core';

import {
  Map,
} from '../services/interfaces';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';

@Component({
  selector: 'app-map-delete-dialog',
  templateUrl: './map-delete-dialog.component.html',
})
export class MapDeleteDialogComponent extends CommonDialogComponent {
  @Input() map: Map;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): Map {
    return this.map;
  }
}
