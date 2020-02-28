import { Component, OnInit, Inject } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';

import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {

  form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl('')
  });

  constructor(
    public dialogRef: MatDialogRef<CreateProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Object
  ) { }

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
      this.dialogRef.close(this.form.value);
    } else {
      this.form.controls['label'].setErrors({required: true});
    }
  }
}
