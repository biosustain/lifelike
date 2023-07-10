import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import {
  ControlContainer,
  FormControl,
  FormGroup,
  FormGroupDirective,
  Validators,
} from '@angular/forms';

import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';

import { AbstractNestedForm } from '../abstract-nested-form';

@Component({
  selector: 'app-annotation-form',
  templateUrl: './annotation-form.component.html',
  styleUrls: ['./annotation-form.component.scss'],
  viewProviders: [
    {provide: ControlContainer, useExisting: FormGroupDirective},
  ],
})
export class AnnotationFormComponent extends AbstractNestedForm implements OnInit, OnChanges {
  @Input() mimeType: string;
  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP)
    .filter((key) => NLPANNOTATIONMODELS.has(key))
    .map((hasKey) => hasKey);

  private readonly defaultAnnotationMethods = this.annotationModels.reduce(
    (obj, key) => ({
      ...obj,
      [key]: new FormGroup({
        nlp: new FormControl(false),
        rulesBased: new FormControl(true),
      }),
    }),
    {},
  );

  readonly formControl = new FormGroup(
    {
      excludeReferences: new FormControl(false),
      annotationMethods: new FormGroup(this.defaultAnnotationMethods),
    },
    [Validators.required],
  );
  readonly name = 'annotationConfigs';
  ngOnInit(): void {
    super.ngOnInit();
  }

  private updateFromObject({annotationConfigs}): void {
    this.formControl.patchValue(annotationConfigs);
  }

  ngOnChanges({object}: SimpleChanges): void {
    if (object) {
      this.updateFromObject(object.currentValue);
    }
  }

  constructor(protected parentFormDirective: FormGroupDirective) {
    super(parentFormDirective);
  }
}

export interface AnnotationFormValue {
  annotationConfigs: {
    excludeReferences: boolean;
    annotationMethods: {
      [key: string]: {
        nlp: boolean;
        rulesBased: boolean;
      }
    }
  }
}
