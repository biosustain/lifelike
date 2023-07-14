import { Component, Input } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { NgbActiveModal, NgbModal, NgbNavChangeEvent } from '@ng-bootstrap/ng-bootstrap';

import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { extractDescriptionFromFile } from 'app/shared/utils/files';
import { AbstractObjectTypeProviderHelper } from 'app/file-types/providers/base-object.type-provider';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { filenameValidator } from 'app/shared/validators';
import { MAX_DESCRIPTION_LENGTH } from 'app/shared/constants';

import { ObjectCreateRequest } from '../../schema';
import { FilesystemObject } from '../../models/filesystem-object';

@Component({
  selector: 'app-object-upload-dialog',
  templateUrl: './object-upload-dialog.component.html',
})
export class ObjectUploadDialogComponent extends CommonFormDialogComponent<any> {
  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly search: SharedSearchService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly modalService: NgbModal,
    private readonly abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper
  ) {
    super(modal, messageDialog);
  }
  @Input() request = {};
  @Input() promptUpload = false;
  @Input() promptParent = false;

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP)
    .filter((key) => NLPANNOTATIONMODELS.has(key))
    .map((hasKey) => hasKey);

  // TODO: We can think about removing this after we add task queue for annotations
  readonly maxFileCount = 5;

  fileList: FileInput<any>[] = [];
  selectedFile: FileInput<any> = null;
  selectedFileIndex;

  private readonly defaultAnnotationMethods = this.annotationModels.reduce(
    (obj, key) => ({
      ...obj,
      [key]: new FormGroup({
        nlp: new FormControl(false),
        rulesBased: new FormControl(true),
      }),
    }),
    {}
  );
  protected filePossiblyAnnotatable = false;

  invalidInputs = false;

  readonly extensionsToCutRegex = /.map$/;

  readonly form: FormGroup = new FormGroup(
    {
      contentSource: new FormControl('contentValue'),
      contentValue: new FormControl(null),
      contentUrl: new FormControl(''),
      parent: new FormControl(null),
      filename: new FormControl('', [Validators.required, filenameValidator]),
      description: new FormControl('', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]),
      public: new FormControl(false),
      contexts: new FormArray([]),
      annotationConfigs: new FormGroup(
        {
          excludeReferences: new FormControl(false),
          annotationMethods: new FormGroup(this.defaultAnnotationMethods),
        },
        [Validators.required]
      ),
      fallbackOrganism: new FormControl(null),
      mimeType: new FormControl(null),
    },
    (group: FormGroup): ValidationErrors | null => {
      if (this.promptUpload) {
        const contentValueControl = group.get('contentValue');
        const contentUrlControl = group.get('contentUrl');

        if (group.get('contentSource').value === 'contentValue') {
          contentUrlControl.setErrors(null);
          if (!contentValueControl.value) {
            contentValueControl.setErrors({
              required: {},
            });
          }
        } else if (group.get('contentSource').value === 'contentUrl') {
          contentValueControl.setErrors(null);
          if (!contentUrlControl.value) {
            contentUrlControl.setErrors({
              required: {},
            });
          }
        }
      }

      if (this.promptParent) {
        const control = group.get('parent');
        if (!control.value) {
          control.setErrors({
            required: {},
          });
        }
      }

      return null;
    }
  );

  // Empty overwrite prevents attempt of returned value to update dialog form
  applyValue(value: any) {}

  // NOTE: We can add the rest of the request data here, but, to be honest, it is redundant.
  // @ts-ignore
  getValue(): ObjectCreateRequest[] {
    const value = this.form.value;

    if (this.fileList.length) {
      // This saves the info about current file
      this.changeSelectedFile(this.selectedFileIndex);
      const uploadRequests = [];
      for (const file of this.fileList) {
        const formState = file.formState;
        uploadRequests.push({
          ...this.abstractObjectTypeProviderHelper.parseToRequest(formState),
          ...this.request,
        });
      }
      return uploadRequests;
    }

    return [
      {
        ...this.abstractObjectTypeProviderHelper.parseToRequest(value),
        ...(value.contentSource === 'contentUrl' && { contentUrl: value.contentUrl }),
        ...this.request,
      } as ObjectCreateRequest,
    ];
  }

  async fileChanged(event: { target: HTMLInputElement }) {
    const uploadLimit = this.maxFileCount - this.fileList.length;
    for (let i = 0; i < event.target.files.length && i < uploadLimit; i++) {
      const targetFile = event.target.files[i];
      const filename: string = targetFile.name.replace(this.extensionsToCutRegex, '');
      await extractDescriptionFromFile(targetFile).then((description) => {
        const fileEntry: FileInput<any> = {
          formState: {
            contentValue: targetFile,
            filename,
            description,
            public: false,
            fallbackOrganism: null,
            annotationsConfigs: {
              annotationMethods: this.defaultAnnotationMethods,
              excludeReferences: true,
            },
          },
          filename,
          hasErrors: false,
          filePossiblyAnnotatable: targetFile.type === 'application/pdf',
        };
        this.fileList.push(fileEntry);
        this.changeSelectedFile(this.fileList.length - 1);
      });
    }
  }

  activeTabChanged(event: NgbNavChangeEvent) {
    if (this.fileList.length || this.form.get('contentUrl').value.length) {
      if (!confirm('Are you sure? Your progress will be lost!')) {
        event.preventDefault();
        return;
      }
    }
    this.fileList = [];
    this.selectedFile = null;
    this.selectedFileIndex = -1;
    this.form.get('contentUrl').setValue('');
    this.form.get('contentSource').setValue(event.nextId);
    this.form.get('contentValue').setValue(null);
    this.form.get('filename').setValue('');
    this.filePossiblyAnnotatable = false;
    this.invalidInputs = false;
  }

  urlChanged(event) {
    this.form.get('filename').setValue(this.extractFilename(event.target.value));
    this.filePossiblyAnnotatable = this.form.get('contentUrl').value.length;
  }

  changeSelectedFile(newIndex: number) {
    const fileCount = this.fileList.length;
    if (fileCount === 0) {
      this.selectedFileIndex = -1;
      this.form.get('contentValue').setValue(null);
      this.filePossiblyAnnotatable = false;
      this.form.get('filename').setValue('');
      this.form.get('description').setValue('');
      return;
    }
    if (newIndex >= fileCount) {
      newIndex = this.fileList.length - 1;
    }
    if (this.selectedFile) {
      // Update file
      this.fileList[this.selectedFileIndex] = {
        filename: this.form.get('filename').value,
        formState: this.form.value,
        hasErrors: !this.form.valid,
        filePossiblyAnnotatable: this.filePossiblyAnnotatable,
      };
    }
    this.selectedFile = this.fileList[newIndex];
    this.selectedFileIndex = newIndex;
    this.form.patchValue(this.selectedFile.formState);
    this.form.get('filename').markAsDirty();
    this.form.get('description').markAsDirty();
    this.filePossiblyAnnotatable = this.selectedFile.filePossiblyAnnotatable;
    // Remove the warnings - they will come back if switched again
    this.selectedFile.hasErrors = false;
    this.invalidInputs = this.fileList.some((file) => file.hasErrors);
  }

  private extractFilename(s: string): string {
    s = s.replace(/^.*[/\\]/, '').trim();
    if (s.length) {
      return s.replace(/(?:\.llmap)?\.json$/i, '');
    } else {
      const isMap = s.match(/\.json$/i);
      return 'document' + (isMap ? '' : '.pdf');
    }
  }

  handleDelete(index: number) {
    this.fileList.splice(index, 1);
    this.selectedFile = null;
    this.changeSelectedFile(this.fileList.length - 1);
  }
}

export interface FileInput<FormState> {
  filename: string;
  formState: FormState;
  hasErrors: boolean;
  filePossiblyAnnotatable: boolean;
}
