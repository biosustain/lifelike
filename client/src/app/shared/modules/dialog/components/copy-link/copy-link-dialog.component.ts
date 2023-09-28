import { Component, ElementRef, Input, NgModule, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageArguments, MessageDialog } from '../../services/message-dialog.service';
import { SharedModule } from '../../../../shared.module';
import { CopyToClipboardDirective } from '../../../../directives/copy-to-clipboard.directive';

// TODO: not used?
@Component({
  selector: 'app-share-dialog',
  templateUrl: './copy-link-dialog.component.html',
})
export class CopyLinkDialogComponent {
  @Input() url: string;

  constructor(public readonly modal: NgbActiveModal) {}

  close(): void {
    this.modal.close();
  }
}

@NgModule({
  declarations: [CopyLinkDialogComponent],
  imports: [SharedModule],
})
class NotUsedModule {
  /**
   * This module is not used anywhere in the codebase.
   * It is only here to make the compiler happy.
   */
  constructor() {
    throw new Error('Not reachable');
  }
}
