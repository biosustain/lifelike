import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { AnnotationConfigurations } from 'app/file-browser/schema';
import { OrganismAutocomplete } from 'app/interfaces';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';


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

  readonly copyBehaviors: CopyBehavior[] = [
    {
      name: CopyBehaviorName.RENAME,
      description: 'New files with a conflicting name will have a number appended to them, e.g. "MyFile.pdf (1)"'
    },
    {
      name: CopyBehaviorName.SKIP,
      description: 'New files with a conflicting name will be discarded, leaving the original intact.'
    },
    {
      name: CopyBehaviorName.OVERWRITE,
      description: 'Old files with a conflicting name will be overwritten.'
    }
  ];
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
    copyBehavior: new FormControl('Rename')
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly search: SharedSearchService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  submit() {
    if (this.form.get('copyBehavior').value === CopyBehaviorName.OVERWRITE) {
      const dialogRef = this.modalService.open(ConfirmDialogComponent);
      dialogRef.componentInstance.title = 'Confirm Overwriting Existing Files';
      dialogRef.componentInstance.message = 'You have chosen to replace existing files when ' +
                                            'there is a filename conflict. Are you sure you ' +
                                            'wish to proceed?';
      return dialogRef.result.then((proceed: boolean) => {
        if (proceed) {
          super.submit();
        }
      });
    } else {
      super.submit();
    }
  }

  getValue(): ObjectBulkUploadDialogValue {
    const formValue = this.form.value;
    return {
      public: formValue.public,
      copyBehavior: formValue.copyBehavior,
      parentHashId: this.parentHashId,
      fallbackOrganism: formValue.organism,
      annotationConfigs: formValue.annotationConfigs     ,
      files: this.fileList
    };
  }

  fileChanged(event: { target: HTMLInputElement }) {
    // Clear the existing list
    this.fileList = [];

    // Add new files
    for (const file of Array.from(event.target.files)) {
      this.fileList.push(file);
    }
  }

  handleDelete(index: number) {
    this.fileList.splice(index, 1);
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }
}

enum CopyBehaviorName {
  RENAME = 'Rename',
  SKIP = 'Skip',
  OVERWRITE = 'Overwrite'
}
interface CopyBehavior {
  name: CopyBehaviorName;
  description: string;
}

export interface ObjectBulkUploadDialogValue {
  public: boolean;
  copyBehavior: CopyBehaviorName;
  parentHashId: string;
  annotationConfigs: AnnotationConfigurations;
  fallbackOrganism: OrganismAutocomplete;
  files: File[];
}
