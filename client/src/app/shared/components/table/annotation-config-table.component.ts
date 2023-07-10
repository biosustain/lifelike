import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-annotation-config-table',
  templateUrl: './annotation-config-table.component.html',
  styleUrls: ['./annotation-config-table.component.scss'],
})
export class AnnotationConfigurationTableComponent {
  @Input() headers: string[];
  @Input() models: string[];
  @Input() form: FormGroup;
  @Input() fileType: string;

  constructor() {}

  checkboxChange(model, method, otherMethod, event) {
    const modelControl = this.form.get('annotationMethods').get(model);
    modelControl.get(method).setValue(event.target.checked);
    modelControl.get(method).markAsDirty();
    modelControl.get(otherMethod).setValue(!event.target.checked);
    modelControl.get(otherMethod).markAsDirty();
  }

  excludeReferences(event) {
    const excludeReferencesControl = this.form.get('excludeReferences');
    excludeReferencesControl.setValue(event.target.checked);
    excludeReferencesControl.markAsDirty();
  }
}
