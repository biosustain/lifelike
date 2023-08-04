import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
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
  @Input() formControl!: FormControl;
  @Input() suggestions: string[];
}
