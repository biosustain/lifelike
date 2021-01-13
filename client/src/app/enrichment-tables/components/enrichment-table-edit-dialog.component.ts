import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { EnrichmentData } from './enrichment-table-viewer.component';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { finalize, map } from 'rxjs/operators';
import { getObjectLabel } from '../../file-browser/utils/objects';

@Component({
  selector: 'app-enrichment-table-edit-dialog',
  templateUrl: './enrichment-table-edit-dialog.component.html',
})
export class EnrichmentTableEditDialogComponent extends CommonFormDialogComponent<EnrichmentData> {
  @Input() object: FilesystemObject;
  @Input() submitButtonLabel = 'Save';
  private _data: EnrichmentData;

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

  @Input() title: string | ((object: FilesystemObject) => string) = o => `Edit Enrichment Parameters for ${getObjectLabel(o)}`;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly search: SharedSearchService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog) {
    super(modal, messageDialog);
  }

  get effectiveTitle(): string {
    return typeof this.title === 'string' ? this.title : this.title(this.object);
  }

  get data() {
    return this._data;
  }

  @Input()
  set data(value: EnrichmentData) {
    this._data = value;

    const resultArray = value.data.split('/');
    const importGenes: string = resultArray[0].split(',').filter(gene => gene !== '').join('\n');
    this.organismTaxId = resultArray[1];
    if (resultArray.length > 3) {
      if (resultArray[3] !== '') {
        this.domains = resultArray[3].split(',');
      }
    }

    const progressDialogRef = this.progressDialog.display({
      title: `Loading Parameters`,
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Loading parameters...',
      })),
    });

    const organismObservable: Observable<OrganismAutocomplete> = this.organismTaxId ?
      this.search.getOrganismFromTaxId(this.organismTaxId) :
      of(null);

    organismObservable.pipe(
      finalize(() => progressDialogRef.close()),
      map(searchResult => {
        this.form.get('entitiesList').setValue(importGenes || '');
        this.setOrganism(searchResult);
        this.setDomains();
        return searchResult;
      }),
      this.errorHandler.createFormErrorHandler(this.form),
      this.errorHandler.create(),
    ).subscribe(() => {
    }, () => {
      // If an error happened, we need to close the dialog because it is totally broken now
      this.cancel();
    });
  }

  private setDomains() {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id + '/' + organism.organism_name : null);
  }

  getValue(): EnrichmentData {
    const value = this.form.value;
    return {
      data: value.entitiesList.replace(/[\/\n\r]/g, ',') + '/' + value.organism + '/' + value.domainsList.join(','),
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
}


