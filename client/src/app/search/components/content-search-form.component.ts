import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormComponent } from 'app/shared/components/base/form.component';

import { ContentSearchOptions, TYPES } from '../content-search';
import { SearchType } from '../shared';

@Component({
  selector: 'app-content-search-form',
  templateUrl: './content-search-form.component.html',
})
export class ContentSearchFormComponent extends FormComponent<ContentSearchOptions> {
  typeChoices: SearchType[] = TYPES.concat().sort((a, b) => a.name.localeCompare(b.name));
  @Output() formResult = new EventEmitter<ContentSearchOptions>();

  form = new FormGroup({
    q: new FormControl('', [this.whitespaceValidator]),
  });

  constructor(messageDialog: MessageDialog) {
    super(messageDialog);
  }

  @Input() set params(params: ContentSearchOptions) {
    super.params = {
      ...params,
      q: this.getQueryStringFromParams(params),
    };
  }

  getQueryStringFromParams(params: ContentSearchOptions) {
    const q = [];
    if (params.hasOwnProperty('q')) {
      q.push(params.q);
    }

    return q.join(' ');
  }

  whitespaceValidator(control: AbstractControl): {[key: string]: any} | null {
    const val =  control.value as string;
    return val.length > 0 && val.match(/.*\S.*/) === null ? {whitespace: {value: control.value}} : null;
  }
}
