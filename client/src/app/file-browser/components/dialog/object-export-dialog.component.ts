import {Component, Input} from '@angular/core';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import {Exporter, ObjectTypeService} from '../../services/object-type.service';
import {FilesystemObject} from '../../models/filesystem-object';
import {mergeMap} from 'rxjs/operators';
import {MAP_MIMETYPE} from '../../../drawing-tool/providers/map.type-provider';

@Component({
  selector: 'app-object-export-dialog',
  templateUrl: './object-export-dialog.component.html',
})
export class ObjectExportDialogComponent extends CommonFormDialogComponent {
  @Input() title = 'Export';

  exporters: Exporter[];
  private _linkedExporters  = ['PDF', 'PNG', 'SVG'];
  private _target: FilesystemObject;
  private isMapExport = false;

  readonly form: FormGroup = new FormGroup({
    exporter: new FormControl(null, Validators.required),
    exportLinked: new FormControl(false)
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog,
              protected readonly objectTypeService: ObjectTypeService) {
    super(modal, messageDialog);
  }

  @Input()
  set target(target: FilesystemObject) {
    this._target = target;
    this.isMapExport = target.mimeType === MAP_MIMETYPE;
    this.objectTypeService.get(target).pipe(
      mergeMap(typeProvider => typeProvider.getExporters(target)),
      mergeMap(exporters => this.exporters = exporters)
    ).subscribe(() => {
      if (this.exporters) {
        this.form.patchValue({
          exporter: 0,
        });
      } else {
        this.modal.dismiss(true);
      }
    });
  }

  get target(): FilesystemObject {
    return this._target;
  }

  getValue(): ObjectExportDialogValue {
    return {
      exporter: this.exporters[this.form.get('exporter').value],
      exportLinked: this.isLinkedExportSupported() && this.form.get('exportLinked').value
    };
  }

  isLinkedExportSupported(): boolean {
    return this.isMapExport && this._linkedExporters.includes(this.exporters[this.form.get('exporter').value].name);
  }
}

export interface ObjectExportDialogValue {
  exporter: Exporter;
  exportLinked: boolean;
}
