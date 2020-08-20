import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Domain, EntityType } from '../../interfaces';
import { DOMAINS, ENTITY_TYPES } from '../../shared/database';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { nonEmptyList } from '../../shared/validators';
import { GraphSearchParameters } from '../graph-search';

@Component({
  selector: 'app-graph-search-form',
  templateUrl: './graph-search-form.component.html',
})
export class GraphSearchFormComponent {
  domainChoices: Domain[] = DOMAINS.concat().sort((a, b) => a.name.localeCompare(b.name));
  entityTypeChoices: EntityType[] = ENTITY_TYPES.concat().sort((a, b) => a.name.localeCompare(b.name));
  @Output() search = new EventEmitter<GraphSearchParameters>();

  form = new FormGroup({
    query: new FormControl('', Validators.required),
    domains: new FormControl('', nonEmptyList),
    entityTypes: new FormControl('', nonEmptyList),
  });

  constructor(private readonly messageDialog: MessageDialog) {
    this.form.patchValue({
      query: '',
      domains: [...this.domainChoices],
      entityTypes: [...this.entityTypeChoices],
    });
  }

  @Input()
  set params(params: GraphSearchParameters) {
    if (params) {
      this.form.patchValue({
        query: params.query,
        domains: params.domains != null ? params.domains : [...this.domainChoices],
        entityTypes: params.entityTypes != null ? params.entityTypes : [...this.entityTypeChoices],
      });
    }
  }

  submit() {
    if (!this.form.invalid) {
      this.search.emit({...this.form.value});
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }

  choiceLabel(choice) {
    return choice.name;
  }
}
