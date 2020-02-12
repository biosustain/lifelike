import { Component, Input, OnChanges } from '@angular/core';
import { Store, select } from '@ngrx/store';

import { Observable } from 'rxjs';

import { State } from '../../***ARANGO_USERNAME***-store';

import { SheetNameAndColumnNames } from 'src/app/interfaces';

import { Neo4jSelectors as selectors } from '../store';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

@Component({
    selector: 'app-import-column-mapping',
    templateUrl: 'import-column-mapping.component.html',
    styleUrls: ['import-column-mapping.component.sass'],
})
export class ImportColumnMappingComponent implements OnChanges {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;

    columnsForFilePreview: string[];
    worksheetDomain: string;

    columnMappingRelationshipForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));

        this.columnsForFilePreview = [];
        this.worksheetDomain = '';
        this.columnMappingRelationshipForm = this.fb.group({columnMapping: this.fb.array([])});
    }

    ngOnChanges() {
        if (this.chosenSheetToMap) {
            this.chosenSheetToMap.sheetColumnNames.forEach(column => {
                this.columnsForFilePreview.push(Object.keys(column)[0]);
            });
        }
    }

    addMappingRow() {
        const form = this.columnMappingRelationshipForm.get('columnMapping') as FormArray;
        const row = this.fb.group({
            newNodeLabel: [''],
            mappedNodeLabel: [''],
            mappedNodeProperty: [''],
        });
        form.push(row);
    }

    goToMapRelationship() {
        
    }
}
