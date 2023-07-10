import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { getFormChangedValues } from 'app/shared/utils/forms';

import { FilesystemObject } from '../../models/filesystem-object';
import { AnnotationFormValue } from './form/annotation-form/annotation-form.component';
import { FallbackOrganismFormValue } from './form/fallback-organism-form/fallback-organism-form.component';
import { FileFormValue } from './form/file-form/file-form.component';

@Component({
  selector: 'app-object-edit-dialog',
  templateUrl: './object-edit-dialog.component.html',
})
export class ObjectEditDialogComponent<
  T extends ObjectEditDialogValue = ObjectEditDialogValue,
  V extends ObjectEditDialogValue = T
> extends CommonFormDialogComponent<T, V> {

  @Input() title = 'Edit Item';
  @Input() parentLabel = 'Location';
  @Input() forceAnnotationOptions = false;

  protected filePossiblyAnnotatable = false;

  readonly form: FormGroup = new FormGroup({
    // fileForm
    // annotationForm
    // organismForm
  });

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly modalService: NgbModal,
  ) {
    super(modal, messageDialog);
  }

  @Input() object!: FilesystemObject;

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable || this.forceAnnotationOptions;
  }

  applyValue(changes: V) {
    this.form.patchValue(changes);
  }

  getValue(): T {
    return {
      object: this.object,
      value: this.form.value,
      changes: getFormChangedValues(this.form),
    } as T;
  }


  onAnnotationMethodPick(method: string, checked: boolean) {
    const field = this.form.get('annotationMethod');
    field.markAsTouched();
    field.setValue(checked ? method : null);
    field.markAsDirty();
  }
}

export type FilesystemObjectEditFormValue =
  FileFormValue
  & AnnotationFormValue
  & FallbackOrganismFormValue;

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  value: FilesystemObjectEditFormValue;
  changes: Partial<this['value']>;
}
