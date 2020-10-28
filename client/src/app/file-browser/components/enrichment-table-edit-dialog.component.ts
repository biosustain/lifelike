import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators } from '@angular/forms';
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
  });
  filename: string;
  organismTaxId: string;

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
      this.search.getOrganismFromTaxId(this.organismTaxId).subscribe((searchResult) => {
        this.form.get('name').setValue(this.filename || '');
        this.form.get('description').setValue(description || '');
        this.form.get('entitiesList').setValue(importGenes || '');
        this.setOrganism(searchResult);
      });
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
}


