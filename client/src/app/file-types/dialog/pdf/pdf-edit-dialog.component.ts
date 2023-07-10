import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { compact as _compact, has as _has, isNil as _isNil, mapValues as _mapValues } from 'lodash/fp';

import { EnrichmentDocument } from 'app/enrichment/models/enrichment-document';
import {
  FilesystemObjectEditFormValue,
  ObjectEditDialogValue,
} from 'app/file-browser/components/dialog/object-edit-dialog.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pdf-edit-dialog',
  templateUrl: './pdf-edit-dialog.component.html',
})
export class PdfEditDialogComponent<
  V extends EnrichmentTableEditDialogResults = EnrichmentTableEditDialogResults
> extends CommonFormDialogComponent<EnrichmentTableEditDialogValue> implements AfterViewInit, OnChanges {

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly search: SharedSearchService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly modalService: NgbModal,
  ) {
    super(modal, messageDialog);
  }
  private _document: EnrichmentDocument;

  @Input() title = 'Edit Enrichment Parameters';
  @Input() submitButtonLabel = 'Save';
  @Input() fileId: string;
  @Input() promptObject = true;
  @Input() object!: FilesystemObject;

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

  form: FormGroup = new FormGroup({
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
    // organismForm
  });

  @Input() document: EnrichmentDocument;

  ngAfterViewInit() {
    this.form.get('fallbackOrganism')?.setValidators([Validators.required]);
  }

  programaticChanges(update) {
    if (_has('document')(update)) {
      this.updateFromDocument(update.document);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    this.programaticChanges(_mapValues(changes, 'currentValue'));
  }

  updateFromDocument({organism, taxID, importGenes, values, domains}: EnrichmentDocument) {
    // Note: This replaces the file's fallback organism
    this.form.get('fallbackOrganism').setValue(
      organism
        ? {
          organism_name: organism,
          synonym: organism,
          tax_id: taxID,
        }
        : null,
    );
    this.form.get('entitiesList').setValue(
      importGenes
        .map((gene) => {
          const geneValue = values.get(gene);
          let row = gene;
          if (!_isNil(geneValue) && geneValue.length) {
            row += `\t${geneValue}`;
          }
          return row;
        })
        .join('\n'),
    );
    this.setDomains(domains);
  }

  // @ts-ignore
  applyValue(changes: V) {
    //   TODO
  }

  private setDomains(domains: string[]) {
    const formArray: FormArray = this.form.get('domainsList') as FormArray;
    domains.forEach((d) => formArray.push(new FormControl(d)));
  }

  getValue() {
    const parentValue = this.form.value;
    const {changes} = parentValue;
    const documentChanges = {} as V['documentChanges'];
    if (_has('entitiesList')(changes)) {
      const geneRows = changes.entitiesList.split(/[\/\n\r]/g);
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
    if (_has('fallbackOrganism')(changes)) {
      const {fallbackOrganism} = changes;
      documentChanges.organism = fallbackOrganism.organism_name;
      documentChanges.taxID = fallbackOrganism.tax_id;
    }
    if (_has('domainsList')(changes)) {
      documentChanges.domains = changes.domainsList;
    }
    if (_has('fileId')(this)) {
      documentChanges.fileId = this.fileId;
    }

    return {
      ...parentValue,
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
  }

  removeControl(controlList: FormArray, control: AbstractControl) {
    const index = controlList.controls.indexOf(control);
    controlList.markAsDirty();
    return index >= 0 && controlList.removeAt(index);
  }

  addControl(controlList: FormArray, control: AbstractControl) {
    controlList.push(control);
  }
}

type EnrichmentDocumentEditFormValue = {
  entitiesList: string; // translated to document values
  domainsList: string[]; // translated to document domains
} & Required<Pick<FilesystemObjectEditFormValue, 'fallbackOrganism'>>;

export interface EnrichmentTableEditDialogValue
  extends ObjectEditDialogValue {
  document: EnrichmentDocument;
  documentChanges: Partial<EnrichmentDocumentEditFormValue>;
}

export type EnrichmentTableEditDialogResults =
  Omit<EnrichmentTableEditDialogValue, 'documentChanges'>
  & {
  documentChanges: Partial<Pick<
    EnrichmentDocument,
    'fileId' | 'taxID' | 'importGenes' | 'values' | 'domains' | 'organism'
  >>;
};
