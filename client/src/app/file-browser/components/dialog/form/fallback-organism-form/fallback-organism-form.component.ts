import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ControlContainer, FormControl, FormGroupDirective } from '@angular/forms';

import { OrganismAutocomplete } from 'app/interfaces';

import { AbstractNestedForm } from '../abstract-nested-form';
import { FilesystemObject } from '../../../../models/filesystem-object';


@Component({
  selector: 'app-fallback-organism-form',
  templateUrl: './fallback-organism-form.component.html',
  styleUrls: ['./fallback-organism-form.component.scss'],
  viewProviders: [
    {provide: ControlContainer, useExisting: FormGroupDirective},
  ],
})
export class FallbackOrganismFormComponent extends AbstractNestedForm implements OnInit, OnChanges {

  readonly formControl = new FormControl(null);
  readonly name: string = 'fallbackOrganism';

  @Input() object!: FilesystemObject;

  ngOnInit(): void {
    super.ngOnInit();
  }

  private updateFromObject({fallbackOrganism}): void {
    this.formControl.patchValue(fallbackOrganism);
  }

  ngOnChanges({object}: SimpleChanges): void {
    if (object) {
      this.updateFromObject(object.currentValue);
    }
  }

  get organismControlTypedValue(): OrganismAutocomplete | null {
    return this.formControl.value as OrganismAutocomplete | null;
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.formControl.setValue(organism ? organism : null);
    this.formControl.markAsDirty();
  }

  constructor(protected parentFormDirective: FormGroupDirective) {
    super(parentFormDirective);
  }
}

export interface FallbackOrganismFormValue {
  fallbackOrganism: OrganismAutocomplete | null;
}
