import { Component, Input } from '@angular/core';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { extractDescriptionFromFile } from 'app/shared/utils/files';

import { ObjectEditDialogComponent } from './object-edit-dialog.component';
import { ObjectCreateRequest } from '../../schema';

@Component({
  selector: 'app-object-publish-dialog',
  templateUrl: './object-publish-dialog.component.html',
})
export class ObjectPublishDialogComponent extends ObjectEditDialogComponent {
  @Input() request = {};

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP)
    .filter((key) => NLPANNOTATIONMODELS.has(key))
    .map((hasKey) => hasKey);

  // TODO: We can think about removing this after we add task queue for annotations
  readonly maxFileCount = 5;

  fileList: FileInput<any>[] = [];
  selectedFile: FileInput<any> = null;
  selectedFileIndex: number;

  invalidInputs = false;

  readonly filenameExtensionSplit = /^(?<filename>.+?)(?<extension>(\.[^.]*)*)$/i;

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly search: SharedSearchService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly modalService: NgbModal
  ) {
    super(modal, messageDialog, modalService);
  }

  // Empty overwrite prevents attempt of returned value to update dialog form
  applyValue(value: any) {}

  // NOTE: We can add the rest of the request data here, but, to be honest, it is redundant.
  // @ts-ignore
  getValue(): ObjectCreateRequest[] {
    const value = this.form.value;

    if (this.fileList.length) {
      // This saves the info about current file
      this.changeSelectedFile(this.selectedFileIndex);
      const publishRequests = [];
      for (const file of this.fileList) {
        const formState = file.formState;
        publishRequests.push({
          ...this.createObjectRequest(formState),
          parentHashId: value.parent ? value.parent.hashId : null,
          contentValue: formState.contentValue,
          ...this.request,
        });
      }
      return publishRequests;
    }

    return [
      {
        ...this.createObjectRequest(value),
        ...this.request,
      } as ObjectCreateRequest,
    ];
  }

  async fileChanged(event: { target: HTMLInputElement }) {
    const publishLimit = this.maxFileCount - this.fileList.length;
    for (let i = 0; i < event.target.files.length && i < publishLimit; i++) {
      const targetFile = event.target.files[i];
      const { filename, extension } = targetFile.name.match(this.filenameExtensionSplit).groups;
      await extractDescriptionFromFile(targetFile).then((description) => {
        const fileEntry: FileInput<any> = {
          formState: {
            contentValue: targetFile,
            filename,
            extension,
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