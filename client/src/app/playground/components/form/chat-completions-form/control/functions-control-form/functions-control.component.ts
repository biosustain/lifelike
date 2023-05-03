import { Component, Input } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { FormArrayWithFactory, FormGroupWithFactory } from 'app/shared/utils/forms/with-factory';

@Component({
  selector: 'app-functions-control',
  templateUrl: './functions-control.component.html',
})
export class FunctionsControlComponent {
  @Input() functionsControl: FormArrayWithFactory<
    FormGroup & {
      controls: {
        name: FormControl;
        description: FormControl;
        parameters: FormGroupWithFactory<FormControl>;
      };
    }
  >;
}