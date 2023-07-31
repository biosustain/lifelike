import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';

import { FormGroupWithFactory } from 'app/shared/utils/form/with-factory';

@Component({
  selector: 'app-logit-bias-control',
  templateUrl: './logit-bias-control.component.html'
})
export class LogitBiasControlComponent {
  @Input() logitBiasControl: FormGroupWithFactory<FormControl, string>;
}
