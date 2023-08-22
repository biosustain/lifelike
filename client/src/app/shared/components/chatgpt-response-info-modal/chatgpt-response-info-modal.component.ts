import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-chatgpt-response-info-modal-modal',
  templateUrl: './chatgpt-response-info-modal.component.html',
})
export class ChatgptResponseInfoModalComponent {
  constructor(private readonly modal: NgbActiveModal) {}

  query: string;

  @Input() set queryParams(qp: object) {
    this.query = JSON.stringify(qp, null, 2);
  }

  close() {
    this.modal.close();
  }
}
