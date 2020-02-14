import { Component, Input, Output, EventEmitter } from '@angular/core';
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
    styleUrls: ['import-column-mapping.component.scss'],
})
export class ImportColumnMappingComponent {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;
    @Input() columnsForFilePreview: string[];
    @Output() nextStep: EventEmitter<boolean>;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;
    dbRelationshipTypes$: Observable<string[]>;

    worksheetDomain: string;

    columnMappingForm: FormGroup;
    nodePropertyMappingForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));
        this.dbRelationshipTypes$ = this.store.pipe(select(selectors.selectDbRelationshipTypes));

        this.worksheetDomain = '';
        this.columnMappingForm = this.fb.group({columnMapping: this.fb.array([])});
        this.nodePropertyMappingForm = this.fb.group({nodePropertyMapping: this.fb.array([])});
        this.nextStep = new EventEmitter();
    }

    addColumnMappingRow() {
        const form = this.columnMappingForm.get('columnMapping') as FormArray;
        const row = this.fb.group({
            columnNode: [],
            newNodeLabel: [],
            mappedNodeLabel: [],
            mappedNodeProperty: [],
            edge: [],
        });
        form.push(row);
    }

    addNodePropertyMappingRow() {
        const form = this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray;
        const row = this.fb.group({
            columnNode: [],
            nodeProperty: [],
        });
        form.push(row);
    }

    deleteColumnMappingRow(idx) {
        (this.columnMappingForm.get('columnMapping') as FormArray).removeAt(idx);
    }

    deleteColumnNodePropertyMappingRow(idx) {
        (this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray).removeAt(idx);
    }

    createNodeMappings() {
        const nodeMapping = {} as NodeMappingHelper;
        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            nodeMapping[Object.values(group.controls.columnNode.value)[0] as number] = {
                nodeType: group.controls.newNodeLabel.value,
                nodeProperties: null,
                mappedNodeType: group.controls.mappedNodeLabel.value,
                mappedNodeProperty: group.controls.mappedNodeProperty.value,
                edge: group.controls.edge.value,
            } as Neo4jNodeMapping;
        });

        const nodePropertyMappingFormArray = this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray;

        nodePropertyMappingFormArray.controls.forEach((group: FormGroup) => {
            nodeMapping[
                Object.values(group.controls.columnNode.value)[0] as number
            ].nodeProperties = group.controls.nodeProperty.value;
        });

        nodeMapping.worksheetDomain = this.worksheetDomain;
        this.store.dispatch(saveNodeMapping({payload: nodeMapping}));
        this.nextStep.emit(true);
    }
}
