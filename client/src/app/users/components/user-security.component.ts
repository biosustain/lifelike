import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from '@angular/core';
import {
    FormGroup,
    FormGroupDirective,
    FormControl,
    NgForm,
    Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material';
import { AppUser, UpdateUserRequest } from 'app/interfaces';

@Component({
    selector: 'app-user-security',
    templateUrl: './user-security.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSecurityComponent {

    @ViewChild('ngSecurityForm', {static: false}) ngSecurityForm: FormGroupDirective;

    @Output() changePassReq: EventEmitter<UpdateUserRequest> = new EventEmitter();

    @Input() user: AppUser;

    securityForm = new FormGroup({
        oldPassword: new FormControl('', [Validators.required]),
        password: new FormControl('', [Validators.required]),
        passwordConfirm: new FormControl(''),
    }, { validators: this.passConfirmValidator });

    passwordMatcher = new PasswordErrorStateMatcher();

    constructor() {}

    passConfirmValidator(form: FormGroup) {
        const password = form.get('password').value as string;
        const confirmPass = form.get('passwordConfirm').value as string;
        if (password !== confirmPass) {
            form.get('passwordConfirm').setErrors({ notMatch: true });
        }
        return null;
    }

    changePassword() {
        if (!this.securityForm.invalid) {
            const password = this.securityForm.get('oldPassword').value;
            const newPassword = this.securityForm.get('password').value;
            this.changePassReq.emit({
                ...this.user,
                newPassword,
                password,
            });
            this.securityForm.reset();
            // Used to reset the validation states
            this.ngSecurityForm.resetForm();
        }
    }
}

/**
 * Custom error handling control used for determining when to
 * display a warning that the new passwords do not match.
 */
export class PasswordErrorStateMatcher implements ErrorStateMatcher {
    isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
        const originalPassCtrl = control.parent.get('password');
        const invalidCtrl = (originalPassCtrl.touched && originalPassCtrl.dirty && !control.valid);
        return invalidCtrl;
    }
}

