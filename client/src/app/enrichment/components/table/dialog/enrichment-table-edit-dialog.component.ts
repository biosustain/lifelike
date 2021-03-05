import { Component, Input, ErrorHandler } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { FilesystemObject } from '../../../../file-browser/models/filesystem-object';
import { EnrichmentDocument } from '../../../models/enrichment-document';
import { ProgressDialog } from '../../../../shared/services/progress-dialog.service';
import { ENRICHMENT_TABLE_MIMETYPE } from '../../../providers/enrichment-table.type-provider';
import { ObjectSelectionDialogComponent } from '../../../../file-browser/components/dialog/object-selection-dialog.component';
import { ObjectCreateRequest } from '../../../../file-browser/schema';

@Component({
  selector: 'app-enrichment-table-edit-dialog',
  templateUrl: './enrichment-table-edit-dialog.component.html',
})
export class EnrichmentTableEditDialogComponent extends CommonFormDialogComponent<EnrichmentTableEditDialogValue> {
  private _object: FilesystemObject;
  private _document: EnrichmentDocument;
  @Input() parentLabel = 'Location';
  @Input() submitButtonLabel = 'Save';
  @Input() fileId: string;
  @Input() promptParent = false;

  form: FormGroup = new FormGroup({
    parent: new FormControl(null),
    filename: new FormControl(''),
    description: new FormControl(),
    public: new FormControl(false),
    organism: new FormControl('', Validators.required),
    entitiesList: new FormControl('', Validators.required),
    domainsList: new FormArray([]),
  }, (group: FormGroup): ValidationErrors | null => {
    if (this.object) {
      {
        const control = group.get('filename');
        if (!control.value) {
          control.setErrors({
            required: {},
          });
        }
      }

      if (this.promptParent) {
        const control = group.get('parent');
        if (!control.value) {
          control.setErrors({
            required: {},
          });
        }
      }
    }

    return null;
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
              protected readonly progressDialog: ProgressDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get object() {
    return this._object;
  }

  @Input()
  set object(value: FilesystemObject) {
    this._object = value;
    this.form.patchValue({
      parent: value.parent,
      filename: value.filename || '',
      description: value.description || '',
      public: value.public || false,
    });
    if (!value.parent) {
      this.promptParent = true;
    }
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

  getValue(): EnrichmentTableEditDialogValue {
    const value = this.form.value;
    const [taxID, organism] = value.organism.split('/');
    this.document.setParameters({
      fileId: this.fileId || '',
      importGenes: value.entitiesList.split(/[\/\n\r]/g),
      taxID,
      organism,
      domains: value.domainsList,
    });

    const result: EnrichmentTableEditDialogValue = {
      document: this.document,
    };

    if (this.object) {
      result.object = this.object;

      result.objectChanges = {
        parent: value.parent,
        filename: value.filename,
        description: value.description,
        public: value.public,
      };

      result.request = {
        filename: value.filename,
        parentHashId: value.parent ? value.parent.hashId : null,
        description: value.description,
        public: value.public,
        mimeType: ENRICHMENT_TABLE_MIMETYPE,
      };
    }

    return result;
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

  showParentDialog() {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.title = 'Select Location';
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    return dialogRef.result.then((destinations: FilesystemObject[]) => {
      this.form.patchValue({
        parent: destinations[0],
      });
    }, () => {
    });
  }
}

export interface EnrichmentTableEditDialogValue {
  document: EnrichmentDocument;
  object?: FilesystemObject;
  objectChanges?: Partial<FilesystemObject>;
  request?: ObjectCreateRequest;
}

