import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../services/project-space.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';

@Component({
  selector: 'app-enrichment-table-create-dialog',
  templateUrl: './enrichment-table-create-dialog.component.html',
})
export class EnrichmentTableCreateDialogComponent extends CommonFormDialogComponent {

  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    description: new FormControl(''),
    organism: new FormControl('', Validators.required),
    entitiesList: new FormControl('', Validators.required),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue() {
    return {
      ...this.form.value,
    };
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id + '/' + organism.organism_name : null);
  }
}


