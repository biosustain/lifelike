import { Component } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-advanced-search-dialog',
  templateUrl: './advanced-search-dialog.component.html',
  styleUrls: ['./advanced-search-dialog.component.scss']
})
export class AdvancedSearchDialogComponent {

  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }

}
