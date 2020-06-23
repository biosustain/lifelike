import { Component} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-terms-of-service-dialog',
  templateUrl: './terms-of-service-dialog.component.html',
})
export class TermsOfServiceDialogComponent {
  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  agree() {
    this.modal.close(true);
  }

  disagree() {
    this.modal.dismiss();
  }
}
