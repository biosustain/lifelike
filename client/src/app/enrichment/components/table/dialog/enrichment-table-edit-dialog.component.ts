import { Component, Input } from "@angular/core";
import { FormArray, FormControl, Validators } from "@angular/forms";

import { compact, isNil } from "lodash-es";
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap";

import { MessageDialog } from "app/shared/services/message-dialog.service";
import { SharedSearchService } from "app/shared/services/shared-search.service";
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from "app/file-browser/components/dialog/object-edit-dialog.component";
import { EnrichmentDocument } from "app/enrichment/models/enrichment-document";
import { ErrorHandler } from "app/shared/services/error-handler.service";
import { ProgressDialog } from "app/shared/services/progress-dialog.service";

import { environment } from "../../../../../environments/environment";

@Component({
  selector: "app-enrichment-table-edit-dialog",
  templateUrl: "./enrichment-table-edit-dialog.component.html",
})
export class EnrichmentTableEditDialogComponent extends ObjectEditDialogComponent {
  @Input() title = "Edit Enrichment Parameters";
  @Input() submitButtonLabel = "Save";
  @Input() fileId: string;
  @Input() promptObject = true;
  organismTaxId: string;
  domains: string[] = [];
  checks: Array<string> = compact([
    "Regulon",
    "UniProt",
    "String",
    "GO",
    "BioCyc",
    environment.keggEnabled && "KEGG",
  ]);

  private _document: EnrichmentDocument;

  get document() {
    return this._document;
  }

  @Input()
  set document(value: EnrichmentDocument) {
    this._document = value;

    this.organismTaxId = value.taxID;
    this.domains = value.domains;
    // Note: This replaces the file's fallback organism
    this.form.get("organism").setValue(
      value.organism
        ? {
            organism_name: value.organism,
            synonym: value.organism,
            tax_id: value.taxID,
          }
        : null
    );
    this.form.get("entitiesList").setValue(
      value.importGenes
        .map((gene) => {
          const geneValue = value.values.get(gene);
          let row = gene;
          if (!isNil(geneValue) && geneValue.length) {
            row += `\t${geneValue}`;
          }
          return row;
        })
        .join("\n")
    );
    this.setDomains();
  }

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly search: SharedSearchService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly modalService: NgbModal
  ) {
    super(modal, messageDialog, modalService);
    this.form.addControl("entitiesList", new FormControl("", Validators.required));
    this.form.addControl("domainsList", new FormArray([]));
    this.form.get("organism").setValidators([Validators.required]);
  }

  getValue(): EnrichmentTableEditDialogValue {
    const parentValue: ObjectEditDialogValue = super.getValue();
    const value = this.form.value;
    const geneRows = (value.entitiesList as string).split(/[\/\n\r]/g);
    const values = new Map<string, string>();
    const expectedRowLen = 2;

    const importGenes = geneRows.map((row) => {
      const cols = row.split("\t");
      if (cols.length < expectedRowLen) {
        cols.concat(Array<string>(expectedRowLen - cols.length).fill(""));
      }
      values.set(cols[0], cols[1]);
      return cols[0];
    });

    this.document.setParameters({
      fileId: value.fileId || this.fileId || "",
      importGenes,
      values,
      taxID: value.organism.tax_id,
      organism: value.organism.organism_name,
      domains: value.domainsList,
    });

    return {
      ...parentValue,
      document: this.document,
    };
  }

  onCheckChange(event) {
    const formArray: FormArray = this.form.get("domainsList") as FormArray;

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

  private setDomains() {
    const formArray: FormArray = this.form.get("domainsList") as FormArray;
    this.domains.forEach((domain) => formArray.push(new FormControl(domain)));
  }
}

export interface EnrichmentTableEditDialogValue extends ObjectEditDialogValue {
  document: EnrichmentDocument;
}
