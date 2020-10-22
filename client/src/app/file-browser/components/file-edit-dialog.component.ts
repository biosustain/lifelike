import { Component, Input } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { OrganismAutocomplete } from '../../interfaces/neo4j.interface';

@Component({
  selector: 'app-dialog-edit-file',
  templateUrl: './file-edit-dialog.component.html',
})
export class FileEditDialogComponent extends CommonFormDialogComponent {
  currentFile: PdfFile;
  organismTaxId: string;

  readonly form: FormGroup = new FormGroup({
    filename: new FormControl('', [
      Validators.required,
      (control: AbstractControl): { [key: string]: any } | null => { // validate against whitespace-only strings
        const filename = control.value;
        const forbidden = filename.trim().length <= 0;
        return forbidden ? {forbiddenFilename: {value: filename}} : null;
      },
    ]),
    description: new FormControl(''),
    organism: new FormControl('')
  });

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
  ) {
    super(modal, messageDialog);
  }

  @Input()
  set organism(value: string) { this.organismTaxId = value; }

  get file() { return this.currentFile; }

  @Input()
  set file(value: PdfFile) {
    this.currentFile = value;
    this.form.get('filename').setValue(value.filename || '');
    this.form.get('description').setValue(value.description || '');
  }

  getValue() {
    return this.form.value;
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }
}
