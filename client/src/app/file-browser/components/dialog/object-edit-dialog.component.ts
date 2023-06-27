import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { flow as _flow, mapValues as _mapValues, pickBy as _pickBy, has as _has } from 'lodash/fp';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { OrganismAutocomplete } from 'app/interfaces';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { filenameValidator } from 'app/shared/validators';
import { MAX_DESCRIPTION_LENGTH } from 'app/shared/constants';

import { FilesystemObject } from '../../models/filesystem-object';
import { AnnotationConfigurations, ObjectCreateRequest } from '../../schema';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';

interface CreateObjectRequest
  extends Omit<ObjectCreateRequest, 'parentHashId' | 'fallbackOrganism'> {
  parent?: FilesystemObject;
  fallbackOrganism?: OrganismAutocomplete;
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
      filename: new FormControl('', [() => ({invalid: 123}), Validators.required, filenameValidator]),
      description: new FormControl('', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]),
      public: new FormControl(false),
      annotationConfigs: new FormGroup(
        {
          excludeReferences: new FormControl(false),
          annotationMethods: new FormGroup(this.defaultAnnotationMethods),
        },
        [Validators.required],
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
      fallbackOrganism: value.fallbackOrganism,
    });
    this.form.get('filename').updateValueAndValidity();

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
  }

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable || this.forceAnnotationOptions;
  }

  applyValue(value: ObjectEditDialogValue) {
    Object.assign(this.object, value.objectChanges);
  }

  getValue(): ObjectEditDialogValue {
    const value = this.form.value as CreateObjectRequest;

    const objectChanges: Partial<FilesystemObject> = _flow(
      // Return only changed values
      _pickBy(({ pristine }: AbstractControl) => !pristine),
      _mapValues((control: AbstractControl) => control.value)
    )(this.form.controls);

    return {
      object: this.object,
      objectChanges,
      patchRequest: this.patchObjectRequest(objectChanges),
      createRequest: this.createObjectRequest(value),
      annotationConfigs: value.annotationConfigs,
      fallbackOrganism: value.fallbackOrganism,
    };
  }

  patchObjectRequest(value: Partial<CreateObjectRequest>): Partial<ObjectCreateRequest> {
    const patch = {} as Partial<ObjectCreateRequest>;
    if (_has('filename', value)) {
      patch.filename = value.filename;
    }
    if (_has('parent.hashId', value)) {
      patch.parentHashId = value.parent?.hashId ?? null;
    }
    if (_has('description', value)) {
      patch.description = value.description;
    }
    if (_has('public', value)) {
      patch.public = value.public;
    }
    if (_has('mimeType', value)) {
      patch.mimeType = value.mimeType;
    }
    // Add annotation-relevant parameters only when needed
    if (this.possiblyAnnotatable) {
      if (_has('fallbackOrganism', value)) {
        patch.fallbackOrganism = value.fallbackOrganism;
      }
      if (_has('annotationConfigs', value)) {
        patch.annotationConfigs = value.annotationConfigs;
      }
    }
    return patch;
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
        fallbackOrganism: value?.fallbackOrganism,
        annotationConfigs: value?.annotationConfigs,
      };
    }
    return object;
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    const organismControl = this.form.get('fallbackOrganism');
    organismControl.setValue(organism ? organism : null);
    organismControl.markAsDirty();
  }

  onAnnotationMethodPick(method: string, checked: boolean) {
    const field = this.form.get('annotationMethod');
    field.markAsTouched();
    field.setValue(method ? method : null);
    field.markAsDirty();
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
      () => {}
    );
  }
}

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  objectChanges: Partial<FilesystemObject>;
  createRequest: ObjectCreateRequest;
  patchRequest: Partial<ObjectCreateRequest>;
  annotationConfigs: AnnotationConfigurations;
  fallbackOrganism: OrganismAutocomplete;
}
