import { Component, OnInit, Input } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { select, Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { Observable } from 'rxjs';
import { filter, debounceTime, switchMap } from 'rxjs/operators';

import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import { OrganismAutocomplete } from '../../interfaces/neo4j.interface';
import { UploadPayload, UploadType } from '../../interfaces/pdf-files.interface';

import { AuthSelectors } from 'app/auth/store';
import { isNullOrUndefined } from 'util';


@Component({
  selector: 'app-dialog-upload',
  templateUrl: './object-upload-dialog.component.html',
})
export class ObjectUploadDialogComponent extends CommonFormDialogComponent implements OnInit {
  @Input() directoryId;

  readonly uploadType = UploadType;
  readonly userRoles$: Observable<string[]>;
  organismChoice: string;

  // select annotation method
  readonly annotationMethods = ['NLP', 'Rules Based'];

  errorMsg = '';
  validFilename = true;

  readonly form: FormGroup = new FormGroup({
    type: new FormControl(''),
    files: new FormControl(''),
    url: new FormControl(''),
    filename: new FormControl('', [
      (control: AbstractControl): { [key: string]: any } | null => { // Validate against whitespace-only strings
        const filename = control.value;
        const forbidden = filename.trim().length <= 0 && this.validFilename;
        return forbidden ? {required: {value: filename}} : null;
      },
    ]),
    description: new FormControl(''),
    annotationMethod: new FormControl(this.annotationMethods[1], [Validators.required]),
    organism: new FormControl('')
  }, [
    (form: FormGroup) => {
      if (form.value.type === UploadType.Files) {
        return Validators.required(form.get('files'));
      } else if (form.value.type === UploadType.Url) {
        return Validators.required(form.get('url'));
      } else {
        return null;
      }
    }
  ]);
  activeTab = UploadType.Files;

  private static extractFilename(s: string): string {
    s = s.replace(/^.*[/\\]/, '').trim();
    if (s.length) {
      return s;
    } else {
      return 'document.pdf';
    }
  }

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    private pdfService: PdfFilesService,
    private store: Store<State>,
  ) {
    super(modal, messageDialog);
    this.form.patchValue({
      type: this.activeTab,
      files: [],
    });

    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
  }

  ngOnInit() {
    this.form.get('filename').valueChanges
      .pipe(
        // Make sure a value is being pushed
        filter(filename => !isNullOrUndefined(filename) && filename.length > 0),
        // 750 ms between each input refresh
        debounceTime(750),
        switchMap(filename => this.pdfService.validateFilename(this.directoryId, filename))
      ).subscribe(validFilename => {
        if (validFilename) {
          this.validFilename = true;
          this.errorMsg = '';
          this.form.get('filename').setErrors(null);
        } else {
          this.validFilename = false;
          this.errorMsg = 'Filename already exists, please choose a different one.';
          this.form.get('filename').setErrors({valid: validFilename});
        }
      });
  }

  activeTabChanged(newId) {
    this.form.get('type').setValue(newId);
    this.form.get('files').setValue([]);
  }

  fileChanged(event) {
    if (event.target.files.length) {
      const file = event.target.files[0];
      this.form.get('files').setValue([file]);
      this.form.get('filename').setValue(file.name);
    } else {
      this.form.get('files').setValue(null);
    }
  }

  onAnnotationMethodPick(method: string, checked: boolean) {
    const field = this.form.get('annotationMethod');
    field.markAsTouched();
    if (checked) {
      field.setValue(method);
    } else {
      field.setValue(null);
    }
  }

  urlChanged(event) {
    this.form.get('filename').setValue(ObjectUploadDialogComponent.extractFilename(event.target.value));
  }

  getValue(): UploadPayload {
    return {
      ...this.form.value,
    };
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? `${organism.synonym}#${organism.tax_id}` : null);
  }
}
