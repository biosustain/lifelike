import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import {
  Subscription
} from 'rxjs';
import {
  Project
} from '../../services/interfaces';

@Component({
  selector: 'app-edit-project-dialog',
  templateUrl: './edit-project-dialog.component.html',
  styleUrls: ['./edit-project-dialog.component.scss']
})
export class EditProjectDialogComponent implements OnInit, OnDestroy {
  form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl(),
    public: new FormControl(false)
  });

  project: Project = null;

  formSubscription: Subscription;

  get isPublic() {
    return this.form.value.public;
  }

  constructor(
    public dialogRef: MatDialogRef<EditProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Project
  ) {
    this.project = data;

    const label = this.project.label;
    const description = this.project.description || '';
    const isPublic = this.project.public || false;

    this.form.setValue({
      label,
      description,
      public: isPublic
    });
  }

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
      // Piece together former project def and
      // new form value to send back
      this.dialogRef.close({
        ...this.project,
        ...this.form.value,
        date_modified: new Date().toISOString()
      });
    } else {
      this.form.controls.label.setErrors({required: true});
    }
  }
}
