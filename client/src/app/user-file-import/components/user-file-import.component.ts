import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatStepper } from '@angular/material';

import { Store, select } from '@ngrx/store';

import { Observable, Subscription } from 'rxjs';

import { State } from 'app/***ARANGO_USERNAME***-store';

import { UserFileImportSelectors as selectors } from '../store';
import {
    uploadNeo4jFile,
    getDbLabels,
    getDbRelationshipTypes,
} from '../store/actions';

import {
    FileNameAndSheets,
    SheetNameAndColumnNames,
    NodeMappingHelper,
} from '../../interfaces/user-file-import.interface';

@Component({
    selector: 'app-user-file-import',
    templateUrl: 'user-file-import.component.html',
    styleUrls: ['user-file-import.component.scss'],
})
export class UserFileImportComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput', { static: true }) fileInput: ElementRef;
    @ViewChild(MatStepper, { static: true }) stepper: MatStepper;

    chosenSheetToMap: SheetNameAndColumnNames;
    fileForm: FormGroup;
    fileName: string;
    relationshipFile: boolean;
    columnsForFilePreview: string[];

    fileNameAndSheets$: Observable<FileNameAndSheets>;
    fielNameAndSheetsSub: Subscription;
    nodeMappingHelper$: Observable<NodeMappingHelper>;
    nodeMappingHelperSub: Subscription;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.fileNameAndSheets$ = this.store.pipe(select(selectors.selectFileNameAndSheets));
        this.nodeMappingHelper$ = this.store.pipe(select(selectors.selectNodeMappingHelper));

        this.fileName = null;
        this.fileForm = this.fb.group({
            fileInput: null,
            crossRef: [false],
        });
        this.relationshipFile = false;
        this.columnsForFilePreview = [];
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
        this.nodeMappingHelperSub.unsubscribe();
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
        this.chosenSheetToMap.sheetColumnNames.forEach(column => {
            this.columnsForFilePreview.push(Object.keys(column)[0]);
        });
        this.store.dispatch(getDbRelationshipTypes());
        this.store.dispatch(getDbLabels());
        this.stepper.next();
    }

    goToMapRelationships() {
        this.stepper.next();
    }
}
