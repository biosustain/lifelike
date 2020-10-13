import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-version-dialog',
  templateUrl: './app-version-dialog.component.html',
})
export class AppVersionDialogComponent {

  buildVersion: string;
  buildTimestamp: string;
  buildCommitHash: string;

  constructor(
    public readonly modal: NgbActiveModal,
  ) {}

  close(): void {
    this.modal.close();
  }
}
