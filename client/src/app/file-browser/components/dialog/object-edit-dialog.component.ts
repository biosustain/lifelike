import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import {FormControl, FormGroup, ValidationErrors, Validators} from '@angular/forms';

import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {MessageDialog} from 'app/shared/services/message-dialog.service';
import {CommonFormDialogComponent} from 'app/shared/components/dialog/common-form-dialog.component';
import {OrganismAutocomplete} from 'app/interfaces';
import {AnnotationMethods, NLPANNOTATIONMODELS} from 'app/interfaces/annotation';
import {ENTITY_TYPE_MAP} from 'app/shared/annotation-types';
import {filenameValidator, validFilenameRegex} from 'app/shared/validators';

import {FilesystemObject} from '../../models/filesystem-object';
import {AnnotationConfigurations, ObjectContentSource, ObjectCreateRequest} from '../../schema';
import {ObjectSelectionDialogComponent} from './object-selection-dialog.component';

@Component({
  selector: 'app-object-edit-dialog',
  templateUrl: './object-edit-dialog.component.html',
})
export class ObjectEditDialogComponent extends CommonFormDialogComponent<ObjectEditDialogValue> {
  @ViewChild('fileInput', {static: false})
  protected readonly fileInputElement: ElementRef;

  @Input() title = 'Edit Item';
  @Input() parentLabel = 'Location';
  @Input() promptUpload = false;
  @Input() forceAnnotationOptions = false;
  @Input() promptParent = false;

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(
    key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);

  private _object: FilesystemObject;
  private filePossiblyAnnotatable = false;

  fileList: FileInput[] = [];
  selectedFile: FileInput = null;
  selectedFileIndex;

  invalidInputs = false;

  readonly defaultAnnotationMethods = this.annotationModels.reduce(
            (obj, key) => ({
              ...obj, [key]: new FormGroup(
                {
                  nlp: new FormControl(false),
                  rulesBased: new FormControl(true),
                }),
            }), {});

  readonly form: FormGroup = new FormGroup({
    contentSource: new FormControl('contentValue'),
    contentValue: new FormControl(null),
    contentUrl: new FormControl(''),
    parent: new FormControl(null),
    filename: new FormControl('', [Validators.required, filenameValidator]),
    description: new FormControl(),
    public: new FormControl(false),
    annotationConfigs: new FormGroup(
      {
        excludeReferences: new FormControl(true),
        annotationMethods: new FormGroup(this.defaultAnnotationMethods),
      }, [Validators.required]),
    organism: new FormControl(null),
    mimeType: new FormControl(null),
  }, (group: FormGroup): ValidationErrors | null => {
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
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get object() {
    return this._object;
  }

  // TODO: This sets an empty filesystem file when clicking the upload button. Maybe get rid of that
  // or find a way to check if input is meaningful
  @Input()
  set object(value: FilesystemObject) {
    this._object = value;
    this.form.patchValue({
      parent: value.parent,
      filename: value.filename || '',
      description: value.description || '',
      public: value.public || false,
      mimeType: value.mimeType,
      organism: value.fallbackOrganism,
    });

    if (!value.parent) {
      this.promptParent = true;
    }

    const annotationConfigs = value.annotationConfigs;
    if (annotationConfigs != null) {
      let ctrl = (
        (this.form.get('annotationConfigs') as FormGroup).get('annotationMethods') as FormControl);
      if (annotationConfigs.annotationMethods != null) {
        for (const [modelName, config] of Object.entries(annotationConfigs.annotationMethods)) {
          if (ctrl.get(modelName)) {
            ctrl.get(modelName).patchValue(config);
          }
        }
      }

      if (annotationConfigs.excludeReferences != null) {
        ctrl = (
          (this.form.get('annotationConfigs') as FormGroup).get('excludeReferences') as FormControl);
        ctrl.patchValue(annotationConfigs.excludeReferences);
      }
    }

    // const file = {
    //   filename: value.filename || '',
    //   formState: this.form.value,
    //   hasValidFilename: !this.form.get('filename').hasError('filenameError'),
    //   // If there are configs, the file is most likely annotable
    //   filePossiblyAnnotatable: annotationConfigs !== null
    // };
    // this.selectedFile = file;
    // this.fileList.push(file);
    // this.selectedFileIndex = this.fileList.length - 1;
  }

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable || this.forceAnnotationOptions;
  }

  private getFileContentRequest(value: { [key: string]: any }): Partial<ObjectContentSource> {
    if (this.promptUpload) {
      switch (value.contentSource) {
        case 'contentValue':
          return {
            contentValue: value.contentValue,
          };
        case 'contentUrl':
          return {
            contentUrl: value.contentUrl,
          };
        default:
          return {};
      }
    } else {
      return {};
    }
  }

  applyValue(value: ObjectEditDialogValue) {
    Object.assign(this.object, value.objectChanges);
  }

  getValue(): ObjectEditDialogValue {
    // This saves the info about current file
    if (this.selectedFileIndex !== -1) {
      this.changeSelectedFile(this.selectedFileIndex);
    }
    const value = this.form.value;

    const objectChanges: Partial<FilesystemObject> = {
      parent: value.parent,
      filename: value.filename,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      fallbackOrganism: value.organism,
      annotationConfigs: value.annotationConfigs,
    };

    const request: ObjectCreateRequest = {
      filename: value.filename,
      parentHashId: value.parent ? value.parent.hashId : null,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      fallbackOrganism: value.organism,
      annotationConfigs: value.annotationConfigs,
      ...this.getFileContentRequest(value),
    };

    const uploadRequests = [];
    for (const file of this.fileList) {
      const formState = file.formState;
      uploadRequests.push({
        filename: formState.filename,
        parentHashId: value.parent ? value.parent.hashId : null,
        description: formState.description,
        public: formState.public,
        mimeType: formState.mimeType,
        fallbackOrganism: formState.organism,
        annotationConfigs: formState.annotationConfigs,
        // No URL upload fir multiple files yet
        contentValue: formState.contentValue
      });
    }

    console.log(uploadRequests.length);

    return {
      object: this.object,
      objectChanges,
      request,
      annotationConfigs: value.annotationConfigs,
      organism: value.organism,
      uploadRequests
    };
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }

  activeTabChanged(newId) {
    if (this.fileList.length ||  this.form.get('contentUrl').value.length) {
      if (!confirm('Are you sure? Your progress will be lost!')) {
       return;
       // this.filePossiblyAnnotatable = newId === 'contentUrl' && this.form.get('contentUrl').value.length;
      }
    }
    this.fileList = [];
    this.selectedFile = null;
    this.selectedFileIndex = -1;
    this.form.get('contantUrl').setValue(null);
    this.form.get('contentSource').setValue(newId);
    this.form.get('contentValue').setValue(null);
    this.filePossiblyAnnotatable = false;
  }

  urlChanged(event) {
    this.form.get('filename').setValue(this.extractFilename(event.target.value));
    this.filePossiblyAnnotatable = this.form.get('contentUrl').value.length;
  }

  fileChanged(event) {
    // TODO: Check if we need this, it seems like this unsets stuff on cancel when selecting files
    const length = event.target.files.length;
    if (length) {
      const promiseList = [];
      for (const targetFile of event.target.files) {
        const filename = this.extractFilename(targetFile.name);

        promiseList.push(this.getDocumentPossibility(targetFile));
        promiseList[promiseList.length - 1].then(maybeDocument => {
          const fileEntry: FileInput = {
            formState: {
              contentValue: targetFile,
              filename,
              description: '',
              public: false,
              organism: null,
              annotationsConfigs: {
                annotationMethods: this.defaultAnnotationMethods,
                excludeReferences: true
              }
            },
            filename,
            hasValidFilename: !validFilenameRegex.test(filename) && filename !== '',
            filePossiblyAnnotatable: maybeDocument,
            annotationsInspected: false
          };
          this.fileList.push(fileEntry);
        });
      }
      // Once all files are pushed, switch to the last one
      Promise.all(promiseList).then( _ => {
        this.changeSelectedFile(this.fileList.length - 1);
      });
    } else {
      // this.form.get('contentValue').setValue(null);
      // this.filePossiblyAnnotatable = false;
    }
  }

  changeSelectedFile(newIndex: number) {
    const fileCount = this.fileList.length;
    if (fileCount === 0) {
      this.selectedFileIndex = -1;
      this.form.get('contentValue').setValue(null);
      this.filePossiblyAnnotatable = false;
      return;
    }
    if (newIndex >= fileCount ) {
      newIndex = this.fileList.length - 1;
    }
    if (this.selectedFile) {
      // Update file
      this.fileList[this.selectedFileIndex] = {
        filename: this.form.get('filename').value,
        formState: this.form.value,
        hasValidFilename: !this.form.get('filename').hasError('filenameError'),
        filePossiblyAnnotatable: this.filePossiblyAnnotatable,
        annotationsInspected: true
      };
    }
    // TODO: Possibly change the form format, due to annotations
    this.selectedFile = this.fileList[newIndex];
    this.selectedFileIndex = newIndex;
    this.form.patchValue(this.selectedFile.formState);
    this.filePossiblyAnnotatable = this.selectedFile.filePossiblyAnnotatable;
    // Remove the warnings - they will come back if switched again
    this.selectedFile.hasValidFilename = true;

    this.invalidInputs = this.fileList.some((file) => !file.hasValidFilename);

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

  private extractFilename(s: string): string {
    s = s.replace(/^.*[/\\]/, '').trim();
    if (s.length) {
      return s.replace(/(?:\.llmap)?\.json$/i, '');
    } else {
      const isMap = s.match(/\.json$/i);
      return 'document' + (isMap ? '' : '.pdf');
    }
  }

  private getDocumentPossibility(file): Promise<boolean> {
    // Too big, assume it could be a document
    if (file.size >= 1024 * 500) {
      return Promise.resolve(true);
    }

    return file.text().then(text => {
      try {
        JSON.parse(text);
        return false;
      } catch (e) {
        return true;
      }
    });
  }

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }

  showParentDialog() {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.title = 'Select Location';
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    return dialogRef.result.then((destinations: FilesystemObject[]) => {
      this.form.patchValue({
        parent: destinations[0],
      });
    }, () => {
    });
  }

  handleDelete(index: number) {
    this.fileList.splice(index, 1);
    this.selectedFile = null;
    this.changeSelectedFile(this.fileList.length - 1);
  }
}


// TODO: Need more data for sure, we might simplify some fields
export interface FileInput {
  filename: string;
  formState: any;
  hasValidFilename: boolean;
  filePossiblyAnnotatable: boolean;
  annotationsInspected: boolean;
}

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  objectChanges: Partial<FilesystemObject>;
  request: ObjectCreateRequest;
  annotationConfigs: AnnotationConfigurations;
  organism: OrganismAutocomplete;
  uploadRequests?: ObjectCreateRequest[];
}
