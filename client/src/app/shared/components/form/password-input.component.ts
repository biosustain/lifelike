import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  templateUrl: './password-input.component.html',
  styleUrls: ['./password-input.component.scss']
})
export class PasswordInputComponent {
  @Input() controlId: string;
  @Input() controlName: string;
  @Input() controlLabel: string;
  @Input() formRef: FormGroup;

  passwordInputType = 'password';
  passwordVisibilityIcon = 'fa-eye';

  get passwordIsShown() {
    return this.passwordInputType !== 'password';
  }

  constructor() {}

  togglePasswordVisibility() {
    this.passwordInputType = this.passwordIsShown ? 'password' : 'text';
    this.passwordVisibilityIcon = this.passwordIsShown ? 'fa-eye-slash' : 'fa-eye';
  }
}
