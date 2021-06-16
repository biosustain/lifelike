import { Component, Input, OnInit } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-rejected-synonyms-dialog',
  templateUrl: './rejected-synonyms-dialog.component.html',
  styleUrls: ['./rejected-synonyms-dialog.component.scss']
})
export class RejectedSynonymsDialogComponent implements OnInit {
  @Input() rejectedSynonyms = new Map<string, string[]>();

  constructor(
    private readonly modal: NgbActiveModal,
  ) { }

  ngOnInit() { }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }

}
