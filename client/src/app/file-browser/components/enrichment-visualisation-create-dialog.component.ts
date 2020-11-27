import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../services/project-space.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';

@Component({
  selector: 'app-enrichment-visualisation-create-dialog',
  templateUrl: './enrichment-visualisation-create-dialog.component.html',
})
export class EnrichmentVisualisationCreateDialogComponent extends CommonFormDialogComponent {

  checks: Array<string> = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'Biocyc'
  ];

  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    description: new FormControl(''),
    organism: new FormControl(''),
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);

    // Each domain is checked by default so add them to the list
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    this.checks.forEach(check => {
      formArray.push(new FormControl(check));
    });
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
    if (event.target.checked) {
      // Add a new control in the arrayForm
      formArray.push(new FormControl(event.target.value));
    } else {
      // find the unselected element
      let i = 0;

      formArray.controls.forEach((ctrl) => {
        if (ctrl.value === event.target.value) {
          // Remove the unselected element from the arrayForm
          formArray.removeAt(i);
          return;
        }

        i++;
      });
    }
  }
}
