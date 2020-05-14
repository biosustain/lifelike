import { Component, ViewChild } from '@angular/core';
import { MatButton } from '@angular/material';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
    FormGroup,
    FormGroupDirective,
    FormControl,
    Validators,
} from '@angular/forms';

import { AccountService } from 'app/users/services/account.service';
import { AppUser, UserCreationRequest } from 'app/interfaces';

@Component({
    selector: 'app-create-user',
    templateUrl: 'create-user.component.html',
    styleUrls: ['./create-user.component.scss']
})
export class CreateUserComponent {

    @ViewChild(FormGroupDirective, {static: false}) formGroupDirective: FormGroupDirective;

    MIN_PASSWORD_LENGTH = 8;

    form: FormGroup = new FormGroup({
        firstName: new FormControl('', Validators.required),
        lastName: new FormControl('', Validators.required),
        username: new FormControl('', Validators.required),
        password: new FormControl(
            '', [Validators.required, Validators.minLength(this.MIN_PASSWORD_LENGTH)]),
        email: new FormControl('', [Validators.required, Validators.email]),
    });

    get firstName() { return this.form.get('firstName'); }
    get lastName() { return this.form.get('lastName'); }
    get username() { return this.form.get('username'); }
    get password() { return this.form.get('password'); }
    get email() { return this.form.get('email'); }

    constructor(
        private accountService: AccountService,
        private snackBar: MatSnackBar,
    ) { }

    submit(submitBtn: MatButton) {
        submitBtn.disabled = true;
        this.accountService.createUser({
            firstName: this.form.value.firstName,
            lastName: this.form.value.lastName,
            username: this.form.value.username,
            password: this.form.value.password,
            email: this.form.value.email,
        } as UserCreationRequest).subscribe(
                (user: AppUser) => {
                    this.accountService.getUserList();
                    this.formGroupDirective.resetForm();
                    this.snackBar.open(
                        `User ${user.username} created!`,
                        'close',
                        {duration: 5000},
                    );
                    submitBtn.disabled = false;
                },
                err => {
                    const msg = err.error.apiHttpError.message;
                    this.snackBar.open(
                        `Error: ${msg}`,
                        'close',
                        {duration: 10000},
                    );
                },
            );
    }
}
