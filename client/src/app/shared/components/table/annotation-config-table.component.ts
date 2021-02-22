import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-annotation-config-table',
  templateUrl: './annotation-config-table.component.html',
  styleUrls: ['./annotation-config-table.component.scss']
})
export class AnnotationConfigurationTableComponent {
  @Input() headers: string[];
  @Input() models: string[];
  @Input() form: FormGroup;

  constructor() {}

  checkboxChange(model, method, otherMethod, event) {
    this.form.get(model).get(method).setValue(event.target.checked);
    this.form.get(model).get(otherMethod).setValue(!event.target.checked);
  }
}
