import { Component, Input, ViewEncapsulation, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { AbstractControlValueAccessor } from '../../utils/forms/abstract-control-value-accessor';

@Component({
  selector: 'app-percent-input',
  templateUrl: './percent-input.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => PercentInputComponent),
    multi: true
  }],
})
export class PercentInputComponent extends AbstractControlValueAccessor<number> {
  @Input() id: string;
  @Input() min: number;
  @Input() max: number;
  @Input() step: number;


  getDefaultValue(): number {
    return 1;
  }

  change(value: number) {
    this.value = value;
    this.valueChange();
  }
}
