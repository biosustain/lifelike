import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatStepper } from '@angular/material';

import { Store, select } from '@ngrx/store';

import { Observable, Subscription } from 'rxjs';

import { State } from '../../root-store';

import { Neo4jSelectors as selectors } from '../store';
import { uploadNeo4jFile, uploadNodeMapping, getDbLabels, uploadRelationshipMapping, getDbRelationshipTypes } from '../store/actions';

import { FileNameAndSheets, SheetNameAndColumnNames, Neo4jColumnMapping, NodeMappingHelper } from '../../interfaces/importer.interface';

@Component({
    selector: 'app-neo4j-upload',
    templateUrl: 'neo4j-upload.component.html',
    styleUrls: ['neo4j-upload.component.scss'],
})
export class Neo4jUploadComponent implements OnInit, OnDestroy {
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

    saveColumnMapping(mapping: {data: Neo4jColumnMapping, type: string}) {
        mapping.data.fileName = this.fileName;
        if (mapping.type === 'node') {
            this.store.dispatch(uploadNodeMapping({payload: mapping.data}));
        } else if (mapping.type === 'relationship') {
            this.store.dispatch(uploadRelationshipMapping({payload: mapping.data}));
        }
    }

    goToMapRelationships() {
        this.stepper.next();
    }
}
