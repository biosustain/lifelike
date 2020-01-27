import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatStepper } from '@angular/material';

import { Store, select } from '@ngrx/store';

import { Observable, Subscription } from 'rxjs';

import { State } from '../../root-store';

import { Neo4jSelectors as selectors } from '../store';
import { uploadNeo4jFile, uploadNeo4jColumnMappingFile, getDbLabels } from '../store/actions';

import { FileNameAndSheets, SheetNameAndColumnNames, Neo4jColumnMapping } from '../../interfaces/neo4j.interface';

@Component({
    selector: 'app-neo4j-upload',
    templateUrl: 'neo4j-upload.component.html',
    styleUrls: ['neo4j-upload.component.sass'],
})
export class Neo4jUploadComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput', { static: true }) fileInput: ElementRef;
    @ViewChild(MatStepper, { static: true }) stepper: MatStepper;

    fileForm: FormGroup;
    fileName: string;
    chosenSheetToMap: SheetNameAndColumnNames;

    fileNameAndSheets$: Observable<FileNameAndSheets>;
    fielNameAndSheetsSub: Subscription;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.fileNameAndSheets$ = this.store.pipe(select(selectors.selectFileNameAndSheets));

        this.fileName = null;
        this.fileForm = this.fb.group({
            fileInput: null,
            crossRef: false,
        });
    }

    ngOnInit() {
        this.fielNameAndSheetsSub = this.fileNameAndSheets$.subscribe(data => {
            // navigate to step 2 Select sheet
            // once server returns parsed data
            if (data) {
                this.stepper.next();
            }
        });
    }

    ngOnDestroy() {
        this.fielNameAndSheetsSub.unsubscribe();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        this.fileName = file.name;
        this.fileForm.controls.fileInput.setValue(file);
    }

    clearFilesField() {
        this.fileName = null;
        this.fileInput.nativeElement.value = '';
    }

    uploadFile() {
        const formData = new FormData();
        formData.append('fileInput', this.fileForm.controls.fileInput.value);
        this.store.dispatch(uploadNeo4jFile({payload: formData}));
    }

    goToMapColumns() {
        this.store.dispatch(getDbLabels());
        this.stepper.next();
    }

    saveColumnMapping(mapping: Neo4jColumnMapping) {
        mapping.fileName = this.fileName;
        this.store.dispatch(uploadNeo4jColumnMappingFile({payload: mapping}));
    }
}
