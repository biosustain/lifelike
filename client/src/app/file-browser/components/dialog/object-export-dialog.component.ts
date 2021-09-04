import { Component, Input } from '@angular/core';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Exporter } from '../../services/object-type.service';

@Component({
  selector: 'app-object-export-dialog',
  templateUrl: './object-export-dialog.component.html',
})
export class ObjectExportDialogComponent extends CommonFormDialogComponent {
  @Input() title = 'Export';

  private _exporters: Exporter[];
  private _linkedExporters  = ['PDF', 'PNG', 'SVG'];

  readonly form: FormGroup = new FormGroup({
    exporter: new FormControl(null, Validators.required),
    exportLinked: new FormControl(false)
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  @Input()
  set exporters(exporters: Exporter[] | undefined) {
    this._exporters = exporters;

    if (exporters) {
      this.form.patchValue({
        exporter: 0,
      });
    } else {
      this.form.patchValue({
        exporter: null,
      });
    }
  }

  get exporters() {
    return this._exporters;
  }

  getValue(): ObjectExportDialogValue {
    return {
      exporter: this.exporters[this.form.get('exporter').value],
      exportLinked: this.isLinkedExportSupported() && this.form.get('exportLinked').value
    };
  }
  isLinkedExportSupported(): boolean {
    return this._linkedExporters.includes(this.exporters[this.form.get('exporter').value].name);
  }
}

export interface ObjectExportDialogValue {
  exporter: Exporter;
  exportLinked: boolean;
}
