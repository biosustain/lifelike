import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Domain, EntityType } from '../../interfaces';
import { DOMAINS, ENTITY_TYPES } from '../../shared/database';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { nonEmptyList } from '../../shared/validators';
import { GraphSearchParameters } from '../graph-search';
import { OrganismAutocomplete } from 'app/interfaces';

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
    organism: new FormControl(null),
  });

  constructor(private readonly messageDialog: MessageDialog) {
    this.form.patchValue({
      query: '',
      domains: [...this.domainChoices],
      entityTypes: [...this.entityTypeChoices],
      organism: '',
    });
  }

  @Input()
  set params(params: GraphSearchParameters) {
    if (params) {
      this.form.patchValue({
        query: params.query,
        domains: params.domains != null ? params.domains : [...this.domainChoices],
        entityTypes: params.entityTypes != null ? params.entityTypes : [...this.entityTypeChoices],
        organism: params.organism,
      });
    }
  }

  submit() {
    if (!this.form.invalid) {
      this.search.emit({...this.form.value});
    } else {
      this.form.markAsDirty();

      let errorMsg = '';
      if (this.form.get('query').getError('required')) {
        errorMsg += 'Search term is required. ';
      }
      if (this.form.get('domains').getError('required')) {
        errorMsg += 'You must select at least one domain. ';
      }
      if (this.form.get('entityTypes').getError('required')) {
        errorMsg += 'You must select at least one entity type. ';
      }

      this.messageDialog.display({
        title: 'Invalid Input',
        message: errorMsg,
        type: MessageType.Error,
      });
    }
  }

  choiceLabel(choice) {
    return choice.name;
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id : null);
  }
}
