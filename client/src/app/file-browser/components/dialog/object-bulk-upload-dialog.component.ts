import { Component, ElementRef, Input, ViewChild } from '@angular/core';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AnnotationConfigurations } from 'app/file-browser/schema';
import { OrganismAutocomplete } from 'app/interfaces';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';

@Component({
  selector: 'app-object-bulk-upload-dialog',
  templateUrl: './object-bulk-upload-dialog.component.html'
})
export class ObjectBulkUploadDialogComponent extends CommonFormDialogComponent<ObjectBulkUploadDialogValue> {
  @ViewChild('fileInput', {static: false})
  protected readonly fileInputElement: ElementRef;

  @Input() title = 'Edit Item';
  @Input() parentHashId: string;

  fileList: File[] = [];

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);
  readonly defaultAnnotationMethods = this.annotationModels.reduce(
    (obj, key) => ({
      ...obj, [key]: new FormGroup(
        {
          nlp: new FormControl(false),
          rulesBased: new FormControl(true),
        }),
    }), {});

  readonly form: FormGroup = new FormGroup({
    public: new FormControl(false),
    annotationConfigs: new FormGroup(
      {
        excludeReferences: new FormControl(false),
        annotationMethods: new FormGroup(this.defaultAnnotationMethods),
      }, [Validators.required]),
    organism: new FormControl(null),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly search: SharedSearchService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get fileNameList() {
    return this.fileList.map(file => file.name).join('; ')
  }

  getValue(): ObjectBulkUploadDialogValue {
    const formValue = this.form.value;
    return {
      public: formValue.public,
      parentHashId: this.parentHashId,
      fallbackOrganism: formValue.organism,
      annotationConfigs: formValue.annotationConfigs     ,
      files: this.fileList
    }
  }

  fileChanged(event: { target: HTMLInputElement }) {
    // Clear the existing list
    this.fileList = [];

    // Add new files
    for (let i = 0; i < event.target.files.length; i++) {
      this.fileList.push(event.target.files[i]);
    }
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }
}

export interface ObjectBulkUploadDialogValue {
  public: boolean;
  parentHashId: string;
  annotationConfigs: AnnotationConfigurations;
  fallbackOrganism: OrganismAutocomplete;
  files: File[];
}
