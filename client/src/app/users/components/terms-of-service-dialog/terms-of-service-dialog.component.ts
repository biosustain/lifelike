import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngrx/store';

import { State } from 'app/root-store';
import { AuthActions } from 'app/auth/store';

export const TERMS_OF_SERVICE = {
  // ISO-8601 Timestamp update
  updateTimestamp: '2020-05-21T00:00:00Z',
};

@Component({
  selector: 'app-terms-of-service-dialog',
  templateUrl: './terms-of-service-dialog.component.html',
  styleUrls: ['./terms-of-service-dialog.component.scss']
})
export class TermsOfServiceDialogComponent implements OnInit {
  // Whehter or not to render the agreement action buttons
  dialogMode = true;

  credential: { email, password };

  constructor(
    public dialogRef: MatDialogRef<TermsOfServiceDialogComponent>,
    private store: Store<State>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.credential = data;
  }

  ngOnInit() {
  }

  agree() {
    const timeStamp = TERMS_OF_SERVICE.updateTimestamp;
    const credential = this.credential;

    this.store.dispatch(
      AuthActions.agreeTermsOfService(
        {
          credential,
          timeStamp
        }
      )
    );
    this.dialogRef.close();
  }

  disagree() {
    this.store.dispatch(
      AuthActions.disagreeTermsOfService()
    );
    this.dialogRef.close();
  }
}
