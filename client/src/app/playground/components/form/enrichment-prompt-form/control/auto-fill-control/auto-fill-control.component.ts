import { Component, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  AbstractControlOptions,
  AsyncValidatorFn,
  FormControl,
  ValidatorFn,
} from '@angular/forms';

@Component({
  selector: 'app-auto-fill-control',
  templateUrl: './auto-fill-control.component.html',
})
export class AutoFillControlComponent {
  @Input() control: FormControl;
  @Input() suggestions: string[];
}
