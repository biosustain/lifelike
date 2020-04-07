import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  Subscription
} from 'rxjs';
import {
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit, OnDestroy {

  form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl('')
  });

  formSubscription: Subscription;

  constructor(
    public dialogRef: MatDialogRef<CreateProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  ngOnInit() {
    this.formSubscription = this.form.valueChanges.subscribe(val => {
      this.form.setErrors({required: null});
    });
  }

  ngOnDestroy() {
    this.formSubscription.unsubscribe();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
  onSubmitClick(): void {
    if (this.form.controls.label.valid) {
      this.dialogRef.close(this.form.value);
    } else {
      this.form.controls.label.setErrors({required: true});
    }
  }
}
