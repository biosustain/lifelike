import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
  Validators,
} from '@angular/forms';
import { OnInit } from '@angular/core';

export abstract class AbstractNestedForm implements OnInit {
  constructor(protected parentFormDirective: FormGroupDirective) {}

  abstract readonly formControl: AbstractControl;
  abstract readonly name: string;

  ngOnInit(): void {
    this.parentFormDirective.form.addControl(this.name, this.formControl);
  }
}
