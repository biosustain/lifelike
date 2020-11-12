import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../services/project-space.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';

@Component({
  selector: 'app-enrichment-table-create-dialog',
  templateUrl: './enrichment-table-create-dialog.component.html',
})
export class EnrichmentTableCreateDialogComponent extends CommonFormDialogComponent {

  checks: Array<string> = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'Biocyc'
  ]

  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    description: new FormControl(''),
    organism: new FormControl('', Validators.required),
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
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

  onCheckChange(event) {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;

    /* Selected */
    if(event.target.checked){
      // Add a new control in the arrayForm
      formArray.push(new FormControl(event.target.value));
    }
    /* unselected */
    else{
      // find the unselected element
      let i: number = 0;

      formArray.controls.forEach((ctrl: FormControl) => {
        if(ctrl.value == event.target.value) {
          // Remove the unselected element from the arrayForm
          formArray.removeAt(i);
          return;
        }

        i++;
      });
    }
  }
}


