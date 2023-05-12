import { Component, Input } from '@angular/core';
import { AbstractControl, FormArray, FormControl, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { compact as _compact, isNil as _isNil, has as _has, omit as _omit } from 'lodash/fp';

import { EnrichmentDocument } from 'app/enrichment/models/enrichment-document';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from 'app/file-browser/components/dialog/object-edit-dialog.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';

import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-enrichment-table-edit-dialog',
  templateUrl: './enrichment-table-edit-dialog.component.html',
})
export class EnrichmentTableEditDialogComponent extends ObjectEditDialogComponent {
  private _document: EnrichmentDocument;

  @Input() title = 'Edit Enrichment Parameters';
  @Input() submitButtonLabel = 'Save';
  @Input() fileId: string;
  @Input() promptObject = true;

  organismTaxId: string;
  domains: string[] = [];

  checks: Array<string> = _compact([
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'BioCyc',
    environment.keggEnabled && 'KEGG',
  ]);

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly search: SharedSearchService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly modalService: NgbModal
  ) {
    super(modal, messageDialog, modalService);
    this.form.addControl('entitiesList', new FormControl('', Validators.required));
    this.form.addControl('domainsList', new FormArray([]));
    this.form.get('fallbackOrganism').setValidators([Validators.required]);
  }

  get document() {
    return this._document;
  }

  @Input() set document(value: EnrichmentDocument) {
    this._document = value;

    this.organismTaxId = value.taxID;
    this.domains = value.domains;
    // Note: This replaces the file's fallback organism
    this.form.get('fallbackOrganism').setValue(
      value.organism
        ? {
            organism_name: value.organism,
            synonym: value.organism,
            tax_id: value.taxID,
          }
        : null
    );
    this.form.get('entitiesList').setValue(
      value.importGenes
        .map((gene) => {
          const geneValue = value.values.get(gene);
          let row = gene;
          if (!_isNil(geneValue) && geneValue.length) {
            row += `\t${geneValue}`;
          }
          return row;
        })
        .join('\n')
    );
    this.setDomains();
    this.setContexts(value.contexts);
  }

  applyValue(value: ObjectEditDialogValue) {}

  private setDomains() {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }

  getValue(): EnrichmentTableEditDialogValue {
    const parentValue: ObjectEditDialogValue = super.getValue();
    const objectChanges = parentValue.objectChanges as {
      entitiesList: string;
      domainsList: any;
      fileId: any;
      fallbackOrganism: any;
    };
    const documentChanges = {} as Partial<EnrichmentDocument>;
    if (_has('entitiesList')(objectChanges)) {
      const geneRows = (objectChanges.entitiesList as string).split(/[\/\n\r]/g);
      documentChanges.values = new Map<string, string>();
      const expectedRowLen = 2;

      documentChanges.importGenes = geneRows.map((row) => {
        const cols = row.split('\t');
        if (cols.length < expectedRowLen) {
          cols.concat(Array<string>(expectedRowLen - cols.length).fill(''));
        }
        documentChanges.values.set(cols[0], cols[1]);
        return cols[0];
      });
    }
    if (_has('fallbackOrganism')(objectChanges)) {
      const { fallbackOrganism } = objectChanges;
      documentChanges.organism = fallbackOrganism.organism_name;
      documentChanges.taxID = fallbackOrganism.tax_id;
    }
    if (_has('domainsList')(objectChanges)) {
      documentChanges.domains = objectChanges.domainsList;
    }
    if (_has('fileId')(objectChanges) || _has('fileId')(this)) {
      documentChanges.fileId = objectChanges.fileId || this.fileId;
    }

    // Finally, update the document with new params
    this.document.setParameters(documentChanges);

    return {
      ...parentValue,
      objectChanges: _omit(['fileId', 'fallbackOrganism', 'domainsList', 'entitiesList'])(
        objectChanges
      ),
      documentChanges,
      document: this.document,
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
    formArray.markAsDirty();
  }

  contextFormControlFactory = (context = '') =>
    new FormControl(context, [Validators.minLength(3), Validators.maxLength(1000)]);

  removeControl(controlList: FormArray, control: AbstractControl) {
    const index = controlList.controls.indexOf(control);
    controlList.markAsDirty();
    return index >= 0 && controlList.removeAt(index);
  }

  addControl(controlList: FormArray, control: AbstractControl) {
    controlList.push(control);
  }
}

export interface EnrichmentTableEditDialogValue extends ObjectEditDialogValue {
  document: EnrichmentDocument;
  documentChanges: Partial<EnrichmentDocument>;
}
