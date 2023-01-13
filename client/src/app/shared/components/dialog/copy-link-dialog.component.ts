import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

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
