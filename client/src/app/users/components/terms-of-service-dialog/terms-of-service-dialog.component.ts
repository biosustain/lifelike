import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export const TERMS_OF_SERVICE = {
  // ISO-8601 Timestamp update
  updateTimestamp: '2020-05-21T00:00:00Z',
}

@Component({
  selector: 'app-terms-of-service-dialog',
  templateUrl: './terms-of-service-dialog.component.html',
  styleUrls: ['./terms-of-service-dialog.component.scss']
})
export class TermsOfServiceDialogComponent implements OnInit {
  // Whehter or not to render the agreement action buttons
  dialogMode = true;

  constructor(
    public dialogRef: MatDialogRef<TermsOfServiceDialogComponent>
  ) {

  }

  ngOnInit() {
  }

  agree() {
    this.dialogRef.close(TERMS_OF_SERVICE.updateTimestamp);
  }

  disagree() {
    this.dialogRef.close();
  }
}
