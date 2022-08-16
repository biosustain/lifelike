import {
  Component,
  Input,
  ViewEncapsulation,
  forwardRef,
  Directive,
  Self,
  HostListener,
  ViewChild,
  ElementRef,
  Renderer2,
  HostBinding
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR,
  NumberValueAccessor,
  NgControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  Validator,
  AbstractControl,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { isEmpty } from 'lodash-es';

import { AbstractControlValueAccessor } from '../../utils/forms/abstract-control-value-accessor';
import { isNotEmpty } from '../../utils';

export const PERCENT_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => PercentInputComponent),
  multi: true
};

export const PERCENT_VALUE_VALIDATOR: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => PercentInputComponent),
  multi: true
};

@Component({
  selector: 'app-percent-input',
  templateUrl: './percent-input.component.html',
  styleUrls: ['./percent-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [PERCENT_VALUE_ACCESSOR, PERCENT_VALUE_VALIDATOR],
})
export class PercentInputComponent implements ControlValueAccessor, Validator {
  /**
   * Min value in percent
   */
  @Input() min: number;
  /**
   * Max value in percent
   */
  @Input() max: number;
  /**
   * Step increase/decrease button value in percent
   */
  @Input() step: number;
  @Input() placeholder: number | string = '';

  /**
   * Object with format callback `{format}`
   */
  @Input() readonly formatter: Intl.NumberFormat = new Intl.NumberFormat(
    'en-US', {maximumFractionDigits: 2, useGrouping: false}
  );

  disabled = false;
  /**
   * Fraction representing procentage value
   */
  value: number;
  /**
   * Result of last validation
   */
  errors: ValidationErrors | null;

  /**
   * The registered callback function called when a change or input event occurs on the input
   * element.
   */
  onChange = (_: any) => {
  }

  /**
   * The registered callback function called when a blur event occurs on the input element.
   */
  onTouched = () => {
  }

  constructor(private renderer: Renderer2) {
  }

  /**
   * Registers a function called when the control is touched.
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * Registers a function called when the control value changes.
   */
  registerOnChange(fn: (_: number | null) => void): void {
    this.onChange = (value) => fn(isEmpty(value) ? null : parseFloat(value) / 100);
  }

  /**
   * Sets the "disabled" property on the range input element.
   */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /**
   * Sets the "value" property on the input element.
   */
  writeValue(value: number) {
    this.value = value ? value * 100 : value;
  }

  validate(abs: AbstractControl): ValidationErrors | null {
    const errors = {
      ...(this.min && Validators.min(this.min / 100)(abs) || {}),
      ...(this.max && Validators.max(this.max / 100)(abs) || {})
    };
    this.errors = isNotEmpty(errors) ? errors : null;
    return errors;
  }
}
