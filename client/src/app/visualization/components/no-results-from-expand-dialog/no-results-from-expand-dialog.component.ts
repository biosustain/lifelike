import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material';

@Component({
  selector: 'app-no-results-from-expand-dialog',
  templateUrl: './no-results-from-expand-dialog.component.html',
  styleUrls: ['./no-results-from-expand-dialog.component.scss']
})
export class NoResultsFromExpandDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<NoResultsFromExpandDialogComponent>,
  ) { }

  ngOnInit() { }

  closeDialog() {
      this.dialogRef.close();
  }

}
