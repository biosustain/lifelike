import { Component } from '@angular/core';

import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {ErrorHandler} from 'app/shared/services/error-handler.service';
import {ProgressDialog} from 'app/shared/services/progress-dialog.service';
import {MessageDialog} from 'app/shared/services/message-dialog.service';
import {SharedSearchService} from 'app/shared/services/shared-search.service';

import {ObjectEditDialogComponent} from './object-edit-dialog.component';
import {ObjectCreateRequest} from '../../schema';

@Component({
  selector: 'app-object-create-dialog',
  templateUrl: './object-create-dialog.component.html',
})

export class ObjectCreateDialogComponent extends ObjectEditDialogComponent {

    constructor(modal: NgbActiveModal,
                messageDialog: MessageDialog,
                protected readonly search: SharedSearchService,
                protected readonly errorHandler: ErrorHandler,
                protected readonly progressDialog: ProgressDialog,
                protected readonly modalService: NgbModal) {
    super(modal, messageDialog, modalService);
  }

  // @ts-ignore
  getValue = (): ObjectCreateRequest => this.createObjectRequest(this.form.value);

}
