import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Input } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

@Component({
  selector: 'app-add-content-dialog',
  templateUrl: './add-content-dialog.component.html',
  styleUrls: ['./add-content-dialog.component.scss']
})
export class AddContentDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy {
  MODE = 'dir';
  @Input()
  set mode(val) {
    this.MODE = val;

    if (this.MODE === 'dir') {
      this.form.get('label').clearValidators();
    } else if (this.MODE === 'map') {
      this.form.get('dirname').clearValidators();
    }
  }
  get mode() {
    return this.MODE;
  }

  form: FormGroup = new FormGroup({
    directoryId: new FormControl(),
    // map
    label: new FormControl('', Validators.required),
    description: new FormControl(),
    // subDir
    dirname: new FormControl('', Validators.required),
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
