import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject } from '../../models/filesystem-object';
import { CommonFormDialogComponent } from '../../../shared/components/dialog/common-form-dialog.component';
import {
  AnnotationGenerationRequest,
  ObjectContentSource,
  ObjectCreateRequest,
} from '../../schema';
import { OrganismAutocomplete } from '../../../interfaces';
import { select, Store } from '@ngrx/store';
import { AuthSelectors } from '../../../auth/store';
import { State } from 'app/***ARANGO_USERNAME***-store';
import { Observable } from 'rxjs';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';
import { AnnotationMethod } from '../../../interfaces/annotation';

@Component({
  selector: 'app-object-annotate-dialog',
  templateUrl: './object-annotate-dialog.component.html',
})
export class ObjectAnnotateDialogComponent extends CommonFormDialogComponent<ObjectAnnotateDialogValue> {
  @Input() objects: FilesystemObject[] = [];
  @Input() title = 'Annotation Options';

  readonly annotationMethodChoices: AnnotationMethod[] = ['NLP', 'Rules Based'];
  readonly userRoles$: Observable<string[]>;

  readonly form: FormGroup = new FormGroup({
    annotationMethod: new FormControl(this.annotationMethodChoices[1], [Validators.required]),
    organism: new FormControl(null),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              store: Store<State>,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
    this.userRoles$ = store.pipe(select(AuthSelectors.selectRoles));
  }

  getValue(): ObjectAnnotateDialogValue {
    const value = this.form.value;

    return {
      request: {
        annotationMethod: value.annotationMethod,
        organism: value.organism,
      },
      annotationMethod: value.annotationMethod,
      organism: value.organism,
    };
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
}

export interface ObjectAnnotateDialogValue {
  request: AnnotationGenerationRequest;
  annotationMethod: AnnotationMethod;
  organism: OrganismAutocomplete;
}
