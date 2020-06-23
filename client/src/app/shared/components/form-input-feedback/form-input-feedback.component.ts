import { AfterViewInit, Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-form-input-feedback',
  templateUrl: './form-input-feedback.component.html',
})
export class FormInputFeedbackComponent {
  @Input() control: AbstractControl | undefined;
  @Input() errors = {};
}
