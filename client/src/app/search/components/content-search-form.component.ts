import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { ContentSearchOptions, TYPES } from '../content-search';
import { SearchType } from '../shared';
import { nonEmptyList } from '../../shared/validators';
import { FormComponent } from '../../shared/components/base/form.component';

@Component({
  selector: 'app-content-search-form',
  templateUrl: './content-search-form.component.html',
})
export class ContentSearchFormComponent extends FormComponent<ContentSearchOptions> {
  typeChoices: SearchType[] = TYPES.concat().sort((a, b) => a.name.localeCompare(b.name));
  @Output() result = new EventEmitter<ContentSearchOptions>();

  form = new FormGroup({
    q: new FormControl('', Validators.required),
    types: new FormControl([], nonEmptyList),
  });

  constructor(messageDialog: MessageDialog) {
    super(messageDialog);
  }

  @Input() set params(params: ContentSearchOptions) {
    super.params = params;
  }

  choiceLabel(choice) {
    return choice.name;
  }
}
