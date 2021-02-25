import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject } from '../../models/filesystem-object';
import { CommonFormDialogComponent } from '../../../shared/components/dialog/common-form-dialog.component';
import { AnnotationConfigs, ObjectContentSource, ObjectCreateRequest } from '../../schema';
import { OrganismAutocomplete } from '../../../interfaces';
import { select, Store } from '@ngrx/store';
import { AuthSelectors } from '../../../auth/store';
import { State } from 'app/***ARANGO_USERNAME***-store';
import { Observable } from 'rxjs';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';
import { AnnotationMethods, NLPANNOTATIONMODELS } from '../../../interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';

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
  @Input() promptAnnotationOptions = true;
  @Input() forceAnnotationOptions = false;
  @Input() promptParent = false;

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(
    key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);
  readonly userRoles$: Observable<string[]>;

  private _object: FilesystemObject;
  private filePossiblyAnnotatable = false;

  readonly form: FormGroup = new FormGroup({
    contentSource: new FormControl('contentValue'),
    contentValue: new FormControl(null),
    contentUrl: new FormControl(''),
    parent: new FormControl(null),
    filename: new FormControl('', Validators.required),
    description: new FormControl(),
    public: new FormControl(false),
    annotationConfigs: new FormGroup(
      this.annotationModels.reduce(
        (obj, key) => ({...obj, [key]: new FormGroup(
          {
            nlp: new FormControl(false),
            rulesBased: new FormControl(true)
          })}), {}), [Validators.required]),
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
              store: Store<State>,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
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
    });
    if (!value.parent) {
      this.promptParent = true;
    }
  }

  @Input()
  set configs(value: AnnotationConfigs) {
    if (value) {
      const ctrl = (this.form.get('annotationConfigs') as FormControl);
      for (const [modelName, config] of Object.entries(value)) {
        if (ctrl.get(modelName)) {
          ctrl.get(modelName).patchValue(config);
        }
      }
    }
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
    const value = this.form.value;

    const objectChanges = {
      parent: value.parent,
      filename: value.filename,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
    };

    const request: ObjectCreateRequest = {
      filename: value.filename,
      parentHashId: value.parent ? value.parent.hashId : null,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      ...this.getFileContentRequest(value),
    };

    const annotationConfigs = {};
    for (const [modelName, config] of Object.entries(value.annotationConfigs)) {
      const model = {};
      for (const key of Object.keys(config)) {
        if (key !== 'disabled') {
          model[key] = config[key];
        }
      }
      annotationConfigs[modelName] = model;
    }

    return {
      object: this.object,
      objectChanges,
      request,
      annotationConfigs,
      organism: value.organism,
    };
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }

  activeTabChanged(newId) {
    this.form.get('contentSource').setValue(newId);
    this.form.get('contentValue').setValue(null);
    this.filePossiblyAnnotatable = newId === 'contentUrl' && this.form.get('contentUrl').value.length;
  }

  urlChanged(event) {
    this.form.get('filename').setValue(this.extractFilename(event.target.value));
    this.filePossiblyAnnotatable = this.form.get('contentUrl').value.length;
  }

  fileChanged(event) {
    if (event.target.files.length) {
      const file = event.target.files[0];
      this.form.get('contentValue').setValue(file);
      this.form.get('filename').setValue(this.extractFilename(file.name));
      this.getDocumentPossibility(file).then(maybeDocument => {
        if (file === this.form.get('contentValue').value) {
          this.filePossiblyAnnotatable = maybeDocument;
        }
      });
    } else {
      this.form.get('contentValue').setValue(null);
      this.filePossiblyAnnotatable = false;
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
}

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  objectChanges: Partial<FilesystemObject>;
  request: ObjectCreateRequest;
  annotationConfigs: AnnotationConfigs;
  organism: OrganismAutocomplete;
}
