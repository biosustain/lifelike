// import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import { MatSnackBar } from '@angular/material';

import { FileNameAndSheets, SheetNameAndColumnNames } from 'app/interfaces';
import { GeneImportRelationship } from 'app/interfaces/kg-import.interface';
import { KgImportService } from 'app/kg-import/services/kg-import.service';
import { UserFileImportService } from 'app/user-file-import/services/user-file-import.service';

@Component({
    selector: 'app-gene-import',
    templateUrl: './gene-import-wizard.component.html',
    styleUrls: ['./gene-import-wizard.component.scss'],
    // Uncommenting this will allow the use of custom icons in the stepper
    // providers: [{
    //     provide: STEPPER_GLOBAL_OPTIONS, useValue: {displayDefaultIndicatorType: false}
    // }]
})
export class GeneImportWizardComponent {
    loadingSheet: boolean;
    importingRelationships: boolean;

    worksheetData: FileNameAndSheets;

    importFileForm: FormGroup;
    sheetForm: FormGroup;

    geneConfigFormValid: boolean;
    geneConfigFormArray: FormArray;

    readonly acceptedFileTypes = '.xlsx';

    get selectedSheet(): SheetNameAndColumnNames {
      return this.sheetForm.get('sheet').value;
    }

    constructor(
        private fb: FormBuilder,
        private userFileImportService: UserFileImportService,
        private kgImportService: KgImportService,
        private snackbar: MatSnackBar,
    ) {
        this.loadingSheet = false;
        this.importingRelationships = false;

        this.worksheetData = null;

        this.importFileForm = this.fb.group({
            fileInput: ['', Validators.required],
        });

        this.sheetForm = this.fb.group({
            sheet: [null, Validators.required],
        });

        this.geneConfigFormValid = false;
        this.geneConfigFormArray =  null;
    }

    /**
     * Sets the file input form control, and retrieves the parsed file data from the backend.
     * @param file file input object
     */
    onFileChange(file: File) {
        this.importFileForm.controls.fileInput.setValue(file);

        const formData = new FormData();
        formData.append('fileInput', this.importFileForm.value.fileInput);

        this.loadingSheet = true;
        this.userFileImportService.uploadExperimentalDataFile(formData).subscribe(result => {
            this.worksheetData = result;

            this.loadingSheet = false;
            this.snackbar.open('Finished loading worksheet!', 'Close', {duration: 3000});
        });
    }

    onSheetNameChange() {
       // Reset the gene config form objects whenever a new sheet is chosen. We can't do this in the
       // gene config component without triggering "Expression Changed After Checks" errors.
       this.geneConfigFormValid = false;
       this.geneConfigFormArray = null;
    }

    onRelationshipFormValidityChanged(valid: boolean) {
        this.geneConfigFormValid = valid;
    }

    onRelationshipsChanged(relationshipForms: FormGroup[]) {
        this.geneConfigFormArray = this.fb.array(relationshipForms);
    }

    importGeneRelationships() {
        this.importingRelationships = true;
        // Need to use rawValue here to get the value of any disabled inputs (e.g.
        // the "nodeLabel2" input if KG Gene was selected for the column value).
        this.kgImportService.importGeneRelationships(
            this.worksheetData.filename,
            this.selectedSheet.sheetName,
            this.geneConfigFormArray.getRawValue() as GeneImportRelationship[],
        ).subscribe(result => {
            // TODO: Eventually we may do something with the result, which is a list
            // of relationships which didn't get matched to genes, if any.
            this.importingRelationships = false;
            this.snackbar.open('Finished importing relationships!', 'Close', {duration: 3000});
        });
    }
}
