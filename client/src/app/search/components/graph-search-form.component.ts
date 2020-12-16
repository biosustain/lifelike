import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { OrganismAutocomplete } from 'app/interfaces';

import { GraphSearchParameters } from '../graph-search';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-graph-search-form',
  templateUrl: './graph-search-form.component.html',
})
export class GraphSearchFormComponent {
  @Output() search = new EventEmitter<GraphSearchParameters>();

  domainChoices: string[] = ['ChEBI', 'GO', 'Literature', 'MeSH', 'NCBI', 'UniProt'];
  entityChoices: string[] = ['Chemicals', 'Diseases', 'Genes', 'Proteins', 'Taxonomy'];
  organismChoice: string;

  form = new FormGroup({
    query: new FormControl('', Validators.required),
    domains: new FormControl(''),
    entities: new FormControl(''),
    organism: new FormControl(null),
  });

  constructor(private readonly messageDialog: MessageDialog) {
    this.form.patchValue({
      query: '',
      domains: [],
      entities: [],
      organism: '',
    });
  }

  @Input()
  set params(params: GraphSearchParameters) {
    if (params) {
      this.organismChoice = params.organism;
      this.form.patchValue({
        query: params.query,
        domains: params.domains != null ? params.domains : [],
        entities: params.entities != null ? params.entities : [],
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
    return choice;
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id : null);
  }
}
