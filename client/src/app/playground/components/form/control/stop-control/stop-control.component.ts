import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';

import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';

@Component({
  selector: 'app-stop-control',
  templateUrl: './stop-control.component.html',
})
export class StopControlComponent {
  @Input() stopControl: FormArrayWithFactory<FormControl, string>;
}
