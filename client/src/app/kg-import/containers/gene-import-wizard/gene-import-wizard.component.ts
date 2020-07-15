// import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

import { FileNameAndSheets, SheetNameAndColumnNames } from 'app/interfaces';
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
    worksheetData: FileNameAndSheets;
    selectedSheet: SheetNameAndColumnNames;

    importFileForm: FormGroup;
    sheetForm: FormGroup;

    acceptedFileTypes: string;

    // TEMP
    organisms: Map<string, number>;

    constructor(
        private fb: FormBuilder,
        private userFileImportService: UserFileImportService,
    ) {
        this.acceptedFileTypes = '.xlsx';

        this.worksheetData = null;
        this.selectedSheet = null;

        this.organisms = new Map<string, number>([
            ['Escherichia coli str. K-12 substr. MG1655', 29424357],
            ['Saccharomyces cerevisiae S288C', 29816395],
            ['Pseudomonas aeruginosa PAO1', 29434923],
            ['Clostridioides difficile 630', 29605729],
        ]);

        this.importFileForm = this.fb.group({
            fileInput: ['', Validators.required],
        });

        this.sheetForm = this.fb.group({
            sheetName: ['', Validators.required],
        });
    }

    /**
     * Sets the file input form control, and retrieves the parsed file data from the backend.
     * @param file file input object
     */
    onFileChange(file: File) {
        this.importFileForm.controls.fileInput.setValue(file);

        const formData = new FormData();
        formData.append('fileInput', this.importFileForm.value.fileInput);

        this.userFileImportService.uploadExperimentalDataFile(formData).subscribe(result => {
            this.worksheetData = result;

            // Set the first sheet as the default value for the sheet form dropdown
            this.sheetForm.controls.sheetName.setValue(this.worksheetData.sheets[0].sheetName);
            this.selectedSheet = this.worksheetData.sheets[0];
        });
    }

    /**
     * Updates both the sheet form and the selectedSheet variable.
     * @param event the name of the selected sheet
     */
    onSheetNameChange(event) {
       this.sheetForm.controls.sheetName.setValue(event.target.value);
       this.selectedSheet = this.worksheetData.sheets.filter(sheet => sheet.sheetName === event.target.value)[0];
    }
}
