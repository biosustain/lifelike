import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy {
  form: FormGroup = new FormGroup({
    projectName: new FormControl('', Validators.required),
    description: new FormControl('')
  });

  isInvalid = false;

  subscription: Subscription;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.subscription = this.form.valueChanges.subscribe(
      resp => this.isInvalid = false
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  getValue() {
    return this.form.value;
  }

  submit() {
    if (this.form.valid) {
      super.submit();
    } else {
      this.isInvalid = true;
    }
  }
}
