import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject } from '../../models/filesystem-object';
import { CommonFormDialogComponent } from '../../../shared/components/dialog/common-form-dialog.component';
import { FileCreateRequest } from '../../schema';
import { OrganismAutocomplete } from '../../../interfaces';
import { select, Store } from '@ngrx/store';
import { AuthSelectors } from '../../../auth/store';
import { State } from 'app/root-store';
import { Observable } from 'rxjs';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';

@Component({
  selector: 'app-object-edit-dialog',
  templateUrl: './object-edit-dialog.component.html',
})
export class ObjectEditDialogComponent extends CommonFormDialogComponent {
  @ViewChild('fileInput', {static: false})
  protected readonly fileInputElement: ElementRef;

  @Input() title = 'Edit Item';
  @Input() parentLabel = 'Location';
  @Input() promptUpload = false;
  @Input() promptAnnotationOptions = false;
  @Input() promptParent = false;

  readonly annotationMethods = ['NLP', 'Rules Based'];
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
    annotationMethod: new FormControl(this.annotationMethods[1], [Validators.required]),
    organism: new FormControl(''),
  }, (group: FormGroup): ValidationErrors | null => {
    if (this.promptUpload) {
      const contentValueControl = group.get('contentValue');
      const contentUrlControl = group.get('contentUrl');

      if (group.get('contentSource').value === 'contentValue') {
        contentValueControl.setErrors(null);
        if (!contentValueControl.value) {
          contentValueControl.setErrors({
            required: {},
          });
        }
      } else if (group.get('contentSource').value === 'contentUrl') {
        contentUrlControl.setErrors(null);
        if (!contentUrlControl.value) {
          contentUrlControl.setErrors({
            required: {},
          });
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
    });
    if (!value.parent) {
      this.promptParent = true;
    }
  }

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable;
  }

  private getFileCreateRequest(value: { [key: string]: any }): Pick<FileCreateRequest, 'contentValue' | 'contentUrl'> {
    switch (value.contentSource) {
      case 'contentValue':
        return {
          contentValue: value.contentValue,
        };
      case 'contentUrl':
        return {
          contentValue: value.contentValue,
        };
      default:
        return {};
    }
  }

  getValue(): ObjectEditDialogValue {
    const value = this.form.value;
    this.object.parent = value.parent;
    this.object.filename = value.filename;
    this.object.description = value.description;
    this.object.public = value.public;

    const request: Partial<FileCreateRequest> = {};
    return {
      object: this.object,
      request: this.getFileCreateRequest(value),
      annotationMethod: value.annotationMethod,
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

  private getDocumentPossibility(file: File): Promise<boolean> {
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
  request: Pick<FileCreateRequest, 'contentValue' | 'contentUrl'>;
  annotationMethod: string;
  organism: OrganismAutocomplete;
}
