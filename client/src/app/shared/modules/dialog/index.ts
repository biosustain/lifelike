import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ProgressDialog } from './services/progress-dialog.service';
import { ProgressDialogComponent } from './components/progress/progress-dialog.component';
import { ResponseAlertComponent } from './components/response-alert/response-alert.component';
import ModalModule from '../modal';
import ErrorModule from '../error';
import { MessageDialogComponent } from './components/message/message-dialog.component';
import { CopyLinkDialogComponent } from './components/copy-link/copy-link-dialog.component';
import { ConfirmDialogComponent } from './components/confirm/confirm-dialog.component';
import { MessageDialog } from './services/message-dialog.service';

const exports = [ConfirmDialogComponent];

@NgModule({
  imports: [NgbModule, CommonModule, ModalModule, ErrorModule],
  declarations: [
    ResponseAlertComponent,
    ProgressDialogComponent,
    MessageDialogComponent,
    ...exports,
  ],
  entryComponents: [...exports],
  providers: [ProgressDialog, MessageDialog],
  exports,
})
export default class DialogModule {}
