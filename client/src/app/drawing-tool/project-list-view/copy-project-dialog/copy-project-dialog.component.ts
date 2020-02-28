import { Component, OnInit, Inject } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import {
  Project
} from '../../services/interfaces';

@Component({
  selector: 'app-copy-project-dialog',
  templateUrl: './copy-project-dialog.component.html',
  styleUrls: ['./copy-project-dialog.component.scss']
})
export class CopyProjectDialogComponent implements OnInit {
  form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl()
  });

  project: Project = null;

  constructor(
    public dialogRef: MatDialogRef<CopyProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Project
  ) { 
    this.project = data;
  }

  ngOnInit() {
    this.form.valueChanges.subscribe(val => {
      this.form.setErrors({required: null});
    });
  }
  onNoClick(): void {
    this.dialogRef.close();
  }
  onSubmitClick(): void {
    if (this.form.controls['label'].valid) {
      // Piece together former project def and 
      // new form value to send back
      this.dialogRef.close({
        ...this.project,
        ...this.form.value,
        date_modified: new Date().toISOString()
      });
    } else {
      this.form.controls['label'].setErrors({required: true});
    }
  }
}
