import {Component, Input} from '@angular/core';
import {CommonFormDialogComponent} from '../../../shared/components/dialog/common-form-dialog.component';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {MessageDialog} from '../../../shared/services/message-dialog.service';
import {FilesystemObject} from '../../models/filesystem-object';
import {ObjectExportRequest} from '../../schema';

@Component({
  selector: 'app-object-export-dialog',
  templateUrl: './object-export-dialog.component.html',
})
export class ObjectExportDialogComponent extends CommonFormDialogComponent {
  private _object: FilesystemObject;
  formats: string[];

  readonly form: FormGroup = new FormGroup({
    format: new FormControl(null, Validators.required),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  @Input()
  set object(object: FilesystemObject | undefined) {
    this._object = object;

    if (object) {
      this.formats = object.exportFormats;
      this.form.patchValue({
        format: this.formats.length ? this.formats[0] : null,
      });
    } else {
      this.formats = [];
      this.form.patchValue({
        format: null,
      });
    }
  }

  get object() {
    return this._object;
  }

  getValue(): ObjectExportDialogValue {
    const format = this.form.get('format').value;
    return {
      object: this.object,
      format,
      extension: `.${format}`,  // TODO: This may be wrong later
      request: {
        format,
      },
    };
  }
}

export interface ObjectExportDialogValue {
  object: FilesystemObject;
  format: string;
  extension: string;
  request: ObjectExportRequest;
}
