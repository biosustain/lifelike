import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../services/project-space.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';

@Component({
  selector: 'app-enrichment-table-edit-dialog',
  templateUrl: './enrichment-table-edit-dialog.component.html',
})
export class EnrichmentTableEditDialogComponent extends CommonFormDialogComponent implements OnInit {
  @Input() fileId: string;
  @Input() projectName: string;

  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    description: new FormControl(''),
    organism: new FormControl('', Validators.required),
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
  });
  filename: string;
  organismTaxId: string;
  domains: string[] = [];

  checks: Array<string> = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'Biocyc'
  ];

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    private readonly filesService: PdfFilesService,
    private search: SharedSearchService,
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.filesService.getEnrichmentData(this.projectName, this.fileId).subscribe((result) => {
      this.filename = result.name;
      const description = result.description;
      const resultArray = result.data.split('/');
      const importGenes: string = resultArray[0].split(',').filter(gene => gene !== '').join('\n');
      this.organismTaxId = resultArray[1];
      if (resultArray.length > 3) {
        if (resultArray[3] !== '') {
          this.domains = resultArray[3].split(',');
        }
      }
      this.search.getOrganismFromTaxId(this.organismTaxId).subscribe((searchResult) => {
        this.form.get('name').setValue(this.filename || '');
        this.form.get('description').setValue(description || '');
        this.form.get('entitiesList').setValue(importGenes || '');
        this.setOrganism(searchResult);
        this.setDomains();
      });
    });
  }

  setDomains() {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }

  getValue() {
    return {
      ...this.form.value,
    };
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

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id + '/' + organism.organism_name : null);
  }
}


