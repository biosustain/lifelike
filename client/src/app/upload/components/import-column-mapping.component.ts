import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { Store, select } from '@ngrx/store';

import { Observable } from 'rxjs';

import { State } from '../../root-store';

import { SheetNameAndColumnNames, Neo4jNodeMapping, NodeMappingHelper } from 'src/app/interfaces';

import { Neo4jSelectors as selectors } from '../store';
import { saveNodeMapping } from '../store/actions';

@Component({
    selector: 'app-import-column-mapping',
    templateUrl: 'import-column-mapping.component.html',
    styleUrls: ['import-column-mapping.component.sass'],
})
export class ImportColumnMappingComponent implements OnChanges {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;
    @Output() nextStep: EventEmitter<boolean>;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;

    columnsForFilePreview: string[];
    worksheetDomain: string;

    columnMappingForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));

        this.columnsForFilePreview = [];
        this.worksheetDomain = '';
        this.columnMappingForm = this.fb.group({columnMapping: this.fb.array([])});
        this.nextStep = new EventEmitter();
    }

    ngOnChanges() {
        if (this.chosenSheetToMap) {
            this.chosenSheetToMap.sheetColumnNames.forEach(column => {
                this.columnsForFilePreview.push(Object.keys(column)[0]);
            });
        }
    }

    addMappingRow() {
        const form = this.columnMappingForm.get('columnMapping') as FormArray;
        const row = this.fb.group({
            columnHeader: [''],
            newNodeLabel: [''],
            mappedNodeLabel: [''],
            mappedNodeProperty: [''],
        });
        form.push(row);
    }

    deleteMappingRow(idx) {
        (this.columnMappingForm.get('columnMapping') as FormArray).removeAt(idx);
    }

    goToMapNodeProperties() {
        const nodeMapping = {} as NodeMappingHelper;
        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            nodeMapping[Object.values(group.controls.columnHeader.value)[0] as number] = {
                nodeType: group.controls.newNodeLabel.value,
                mappedNodeType: group.controls.mappedNodeLabel.value,
                mappedNodeProperty: group.controls.mappedNodeProperty.value,
            } as Neo4jNodeMapping;
        });

        nodeMapping.worksheetDomain = this.worksheetDomain;
        this.store.dispatch(saveNodeMapping({payload: nodeMapping}));
        this.nextStep.emit(true);
    }
}
