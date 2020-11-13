import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-dialog-confirm-deletion',
  templateUrl: './object-delete-dialog.component.html',
})
export class ObjectDeleteDialogComponent extends CommonDialogComponent {
  @Input() objects: FilesystemObject[];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): DirectoryObject[] {
    return this.objects;
  }
}
