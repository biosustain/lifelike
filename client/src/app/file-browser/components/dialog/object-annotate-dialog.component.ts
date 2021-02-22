import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { FilesystemObject } from '../../models/filesystem-object';
import { CommonFormDialogComponent } from '../../../shared/components/dialog/common-form-dialog.component';
import {
  PDFAnnotationGenerationRequest,
  AnnotationConfigs,
} from '../../schema';
import { OrganismAutocomplete } from '../../../interfaces';
import { select, Store } from '@ngrx/store';
import { AuthSelectors } from '../../../auth/store';
import { State } from 'app/root-store';
import { Observable } from 'rxjs';
import { AnnotationMethods, NLPANNOTATIONMODELS } from '../../../interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';

@Component({
  selector: 'app-object-annotate-dialog',
  templateUrl: './object-annotate-dialog.component.html',
})
export class ObjectAnnotateDialogComponent extends CommonFormDialogComponent<ObjectAnnotateDialogValue> {
  @Input() objects: FilesystemObject[] = [];
  @Input() title = 'Annotation Options';

  readonly annotationMethodChoices: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(
    key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);
  readonly userRoles$: Observable<string[]>;

  readonly form: FormGroup = new FormGroup({
    annotationConfigs: new FormGroup(
      this.annotationModels.reduce(
        (obj, key) => ({...obj, [key]: new FormGroup(
          {
            nlp: new FormControl(false),
            rulesBased: new FormControl(true)
          })}), {}), [Validators.required]),
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
      request: {
        annotationConfigs,
        organism: value.organism,
      },
      annotationConfigs,
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
  request: PDFAnnotationGenerationRequest;
  annotationConfigs: AnnotationConfigs;
  organism: OrganismAutocomplete;
}
