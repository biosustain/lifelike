import { Component, Input } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ContentSearchOptions, TYPES } from '../content-search';
import { SearchType } from '../shared';

@Component({
  selector: 'app-advanced-search-dialog',
  templateUrl: './advanced-search-dialog.component.html',
  styleUrls: ['./advanced-search-dialog.component.scss']
})
export class AdvancedSearchDialogComponent {
  @Input() set params(params: ContentSearchOptions) {
    this.form.setValue({
      ...this.form.value,
      q: params.q,
      types: params.types,
    });
  }

  typeChoices: SearchType[] = TYPES.concat().sort((a, b) => a.name.localeCompare(b.name));

  form = new FormGroup({
    q: new FormControl('', [Validators.required, this.whitespaceValidator]),
    types: new FormControl([]),
  });

  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    if (this.form.valid) {
      this.modal.close(this.form.value);
    } else {
      this.form.markAsDirty();
    }
  }

  choiceLabel(choice) {
    return choice.name;
  }

  whitespaceValidator(control: AbstractControl): {[key: string]: any} | null {
    const val =  control.value as string;
    return val.length > 0 && val.match(/.*\S.*/) === null ? {whitespace: {value: control.value}} : null;
  }
}
