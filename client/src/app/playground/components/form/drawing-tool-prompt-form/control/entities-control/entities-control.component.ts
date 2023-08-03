import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';

@Component({
  selector: 'app-entities-control',
  templateUrl: './entities-control.component.html',
})
export class EntitiesControlComponent {
  @Input() entitiesControl!: FormArrayWithFactory<FormControl>;
}
