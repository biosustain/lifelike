import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import {
  AbstractControl,
  ControlContainer,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
  Validators,
} from '@angular/forms';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MAX_DESCRIPTION_LENGTH } from 'app/shared/constants';
import { filenameValidator } from 'app/shared/validators';

import { FilesystemObject } from '../../../../models/filesystem-object';
import { ObjectSelectionDialogComponent } from '../../object-selection-dialog.component';
import { AbstractNestedForm } from '../abstract-nested-form';

@Component({
  selector: 'app-file-form',
  templateUrl: './file-form.component.html',
  styleUrls: ['./file-form.component.scss'],
  viewProviders: [
    {provide: ControlContainer, useExisting: FormGroupDirective},
  ],
})
export class FileFormComponent extends AbstractNestedForm implements OnInit, OnChanges {
  get parentControlTypedValue() {
    return this.formControl.get('parent')?.value as FilesystemObject;
  }

  constructor(
    protected parentFormDirective: FormGroupDirective,
    private modalService: NgbModal,
  ) {
    super(parentFormDirective);
  }

  @Input() name = 'file';
  formControl = new FormGroup({
    parent: new FormControl(null),
    filename: new FormControl('', [Validators.required, filenameValidator]),
    description: new FormControl('', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]),
    public: new FormControl(false),
    contexts: new FormArray([]),
  });

  @Input() object: FilesystemObject;
  @Input() parentLabel: string;

  contextsControl = this.formControl.get('contexts') as FormArray;

  ngOnInit(): void {
    super.ngOnInit();
  }

  showParentDialog() {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.hashId = null;
    dialogRef.componentInstance.title = 'Select Location';
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    return dialogRef.result.then(
      (destinations: FilesystemObject[]) => {
        this.formControl.patchValue({
          parent: destinations[0],
        });
      },
      () => {
      },
    );
  }

  private updateFromObject({filename, description, parent, public: p, contexts}): void {
    this.formControl.patchValue({
      filename: filename || '',
      description: description || '',
      public: p || false,
    });
    this.formControl.get('filename').updateValueAndValidity();
    if (parent) {
      this.formControl.get('parent').disable();
    } else {
      this.formControl.get('parent').enable();
    }
    this.setContexts(contexts);
  }

  ngOnChanges({object}: SimpleChanges): void {
    if (object) {
      this.updateFromObject(object.currentValue);
    }
  }

  protected setContexts(contexts) {
    const formArray: FormArray = this.formControl.get('contexts') as FormArray;
    contexts?.forEach((context) => formArray.push(this.contextFormControlFactory(context)));
  }

  contextFormControlFactory = (context = '') =>
    new FormControl(context, [Validators.minLength(3), Validators.maxLength(1000)]);

  setValueFromEvent(control, $event) {
    control.setValue($event.target.value);
    control.markAsDirty();
  }

  addControl(controlList: FormArray, control: AbstractControl) {
    controlList.push(control);
  }

  removeControl(controlList: FormArray, control: AbstractControl) {
    const index = controlList.controls.indexOf(control);
    controlList.markAsDirty();
    return index >= 0 && controlList.removeAt(index);
  }
}

export interface FileFormValue {
  file: {
    filename: string;
    description: string;
    parent: FilesystemObject;
    public: boolean;
    contexts: string[];
  };
}
