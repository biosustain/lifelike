import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { EnrichmentDocument } from '../../../models/enrichment-document';
import { ErrorHandler } from '../../../../shared/services/error-handler.service';
import { ProgressDialog } from '../../../../shared/services/progress-dialog.service';

@Component({
  selector: 'app-enrichment-table-edit-dialog',
  templateUrl: './enrichment-table-edit-dialog.component.html',
})
export class EnrichmentTableEditDialogComponent extends CommonFormDialogComponent<EnrichmentDocument> {
  _document: EnrichmentDocument;
  @Input() submitButtonLabel = 'Save';

  form: FormGroup = new FormGroup({
    organism: new FormControl('', Validators.required),
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
  });

  organismTaxId: string;
  domains: string[] = [];

  checks: Array<string> = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'Biocyc',
  ];

  @Input() title = 'Edit Enrichment Parameters';

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly search: SharedSearchService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog) {
    super(modal, messageDialog);
  }

  get document() {
    return this._document;
  }

  @Input()
  set document(value: EnrichmentDocument) {
    this._document = value;

    this.organismTaxId = value.taxID;
    this.domains = value.domains;
    this.form.get('entitiesList').setValue(value.importGenes.join('\n'));
    this.setOrganism(value.organism ? {
      organism_name: value.organism,
      synonym: value.organism,
      tax_id: value.taxID,
    } : null);
    this.setDomains();
  }

  private setDomains() {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id + '/' + organism.organism_name : null);
  }

  getValue(): EnrichmentDocument {
    const value = this.form.value;
    const [taxId, organism] = value.organism.split('/');
    this.document.setParameters({
      importGenes: value.entitiesList.split(/[\/\n\r]/g),
      taxID: taxId,
      organism,
      domains: value.domainsList,
    });
    return this.document;
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


