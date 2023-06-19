import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { OrganismAutocomplete } from 'app/interfaces';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MAX_DESCRIPTION_LENGTH } from 'app/shared/constants';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { filenameValidator } from 'app/shared/validators';

import { FilesystemObject } from '../../models/filesystem-object';
import { AnnotationConfigurations, ObjectCreateRequest } from '../../schema';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';

interface CreateObjectRequest
  extends Omit<ObjectCreateRequest, 'parentHashId' | 'fallbackOrganism'> {
  parent?: FilesystemObject;
  organism?: OrganismAutocomplete;
}

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
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP)
    .filter((key) => NLPANNOTATIONMODELS.has(key))
    .map((hasKey) => hasKey);

  private _object: FilesystemObject;
  protected filePossiblyAnnotatable = false;

  readonly defaultAnnotationMethods = this.annotationModels.reduce(
    (obj, key) => ({
      ...obj,
      [key]: new FormGroup({
        nlp: new FormControl(false),
        rulesBased: new FormControl(true),
      }),
    }),
    {},
  );

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
        [Validators.required],
      ),
      organism: new FormControl(null),
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
    },
  );

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly modalService: NgbModal,
  ) {
    super(modal, messageDialog);
  }

  get object() {
    return this._object;
  }

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
    this.form.get('filename').markAsDirty();

    if (!value.parent) {
      this.promptParent = true;
    }

    const annotationConfigs = value.annotationConfigs;
    if (annotationConfigs != null) {
      let ctrl = (this.form.get('annotationConfigs') as FormGroup).get(
        'annotationMethods',
      ) as FormControl;
      if (annotationConfigs.annotationMethods != null) {
        for (const [modelName, config] of Object.entries(annotationConfigs.annotationMethods)) {
          if (ctrl.get(modelName)) {
            ctrl.get(modelName).patchValue(config);
          }
        }
      }

      if (annotationConfigs.excludeReferences != null) {
        ctrl = (this.form.get('annotationConfigs') as FormGroup).get(
          'excludeReferences',
        ) as FormControl;
        ctrl.patchValue(annotationConfigs.excludeReferences);
      }
    }

    this.setContexts(value.contexts);
  }

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable || this.forceAnnotationOptions;
  }

  protected setContexts(contexts) {
    const formArray: FormArray = this.form.get('contexts') as FormArray;
    contexts?.forEach(context => formArray.push(this.contextFormControlFactory(context)));
  }

  get contexts() {
    return this.form.get('contexts') as FormArray;
  }

  contextFormControlFactory = (context = '') => new FormControl(context, [Validators.minLength(3), Validators.maxLength(1000)]);

  applyValue(value: ObjectEditDialogValue) {
    Object.assign(this.object, value.objectChanges);
  }

  getValue(): ObjectEditDialogValue {
    const value = this.form.value as CreateObjectRequest;

    const objectChanges: Partial<FilesystemObject> = {
      parent: value.parent,
      filename: value.filename,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      fallbackOrganism: value.organism,
      annotationConfigs: value.annotationConfigs,
    };

    const request: ObjectCreateRequest = this.createObjectRequest(value);

    return {
      object: this.object,
      objectChanges,
      request,
      annotationConfigs: value.annotationConfigs,
      organism: value.organism,
      contexts: value.contexts,
    };
  }

  createObjectRequest(value: CreateObjectRequest): ObjectCreateRequest {
    const object = {
      filename: value.filename,
      parentHashId: value.parent?.hashId ?? null,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
    };
    // Add annotation-relevant parameters only when needed
    if (this.possiblyAnnotatable) {
      return {
        ...object,
        fallbackOrganism: value?.organism,
        annotationConfigs: value?.annotationConfigs,
      };
    }
    return object;
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
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

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }

  showParentDialog() {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.hashId = null;
    dialogRef.componentInstance.title = 'Select Location';
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    return dialogRef.result.then(
      (destinations: FilesystemObject[]) => {
        this.form.patchValue({
          parent: destinations[0],
        });
      },
      () => {
      },
    );
  }

  setValueFromEvent(control, $event) {
    return control.setValue($event.target.value);
  }
}

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  objectChanges: Partial<FilesystemObject>;
  request: ObjectCreateRequest;
  annotationConfigs: AnnotationConfigurations;
  organism: OrganismAutocomplete;
  contexts: string[];
}
