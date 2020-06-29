import { Component, Input } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  Project
} from '../services/interfaces';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-map-edit-dialog',
  templateUrl: './map-edit-dialog.component.html',
})
export class MapEditDialogComponent extends CommonFormDialogComponent {
  @Input() currentMap: Project;

  readonly form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl(),
    public: new FormControl(false)
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  get map() {
    return this.currentMap;
  }

  @Input()
  set map(value: Project) {
    this.currentMap = value;
    this.form.setValue({
      label: value.label || '',
      description: value.description || '',
      public: value.public || false,
    });
  }

  getValue(): Project {
    const map = this.map;
    map.label = this.form.value.label;
    map.description = this.form.value.description;
    map.public = this.form.value.public;
    return map;
  }
}
