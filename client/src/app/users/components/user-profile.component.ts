import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AppUser,  UserUpdateRequest } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';


@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent implements OnInit  {

  @Input() user: AppUser;

  form = new FormGroup({
    username: new FormControl({value: '', disabled: true}),
    firstName: new FormControl({value: '', disabled: false}),
    lastName: new FormControl({value: '', disabled: false}),
    email: new FormControl({value: '', disabled: true}),
  });

  constructor() {
  }

  ngOnInit() {
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
    });
  }

  getValue(): UserUpdateRequest {
    return {
      ...this.form.value,
    };
  }
  cancel() {
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
    });
  }

  submit(): UserUpdateRequest {
        return {
      ...this.form.value,
    };
  }

}
