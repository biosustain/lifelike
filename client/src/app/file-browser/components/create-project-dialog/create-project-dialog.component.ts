import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit, OnDestroy{
  form: FormGroup = new FormGroup({
    projectName: new FormControl('', Validators.required),
    description: new FormControl('')
  });

  isInvalid = false;

  subscription: Subscription;

  constructor(
    public activeModal: NgbActiveModal
  ) {}

  ngOnInit() {
    this.subscription = this.form.valueChanges.subscribe(
      resp => this.isInvalid = false
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  doNothing() {
    this.activeModal.dismiss()
  }

  submit() {
    if (this.form.valid) {
      this.activeModal.close(
        this.form.value
      );
    } else {
      this.isInvalid = true;
    }
  }
}
