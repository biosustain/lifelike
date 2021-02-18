import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { SharedSearchService } from 'app/shared/services/shared-search.service';

import { BehaviorSubject, Observable, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  EnrichmentVisualisationParameters
} from '../enrichment-visualisation-viewer.component';
import { getObjectLabel } from '../../../../file-browser/utils/objects';
import { ErrorHandler } from '../../../../shared/services/error-handler.service';
import { ProgressDialog } from '../../../../shared/services/progress-dialog.service';
import { Progress } from '../../../../interfaces/common-dialog.interface';

@Component({
  selector: 'app-enrichment-visualisation-edit-dialog',
  templateUrl: './enrichment-visualisation-edit-dialog.component.html',
})
export class EnrichmentVisualisationEditDialogComponent extends CommonFormDialogComponent {
  @Input() object: FilesystemObject;
  @Input() submitButtonLabel = 'Save';
  private _data: EnrichmentVisualisationParameters;

  form: FormGroup = new FormGroup({
    organism: new FormControl(''),
    genes: new FormControl('', Validators.required),
    domains: new FormArray([]),
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
  set data({
             genes = [],
             organism,
             domains = []
           }) {

    this.organismTaxId = organism;
    this.domains = domains;

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
        this.form.get('genes').setValue(genes.join('\n') || '');
        this.setOrganism(searchResult);
        this.setDomains();
        return searchResult;
      }),
      this.errorHandler.createFormErrorHandler(this.form),
      this.errorHandler.create({label: 'Get organism for enrichment visualisation'}),
    ).subscribe(() => {
    }, () => {
      // If an error happened, we need to close the dialog because it is totally broken now
      this.cancel();
    });
  }

  private setDomains() {
    const formArray: FormArray = this.form.get('domains') as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id + '/' + organism.organism_name : null);
  }

  getValue(): EnrichmentVisualisationParameters {
    const {genes = '', organism, ...rest} = this.form.value;
    return {
      organism: organism || null,
      genes: genes.split(/[\n \t,;]/),
      ...rest
    };
  }


  onCheckChange(event) {
    const formArray: FormArray = this.form.get('domains') as FormArray;

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


