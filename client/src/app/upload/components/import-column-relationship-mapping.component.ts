import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatCheckboxChange, MatSelectChange } from '@angular/material';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { Store, select } from '@ngrx/store';

import { SheetNameAndColumnNames, Neo4jColumnMapping, NodeMappingHelper } from '../../interfaces/importer.interface';

import { State } from '../../***ARANGO_USERNAME***-store';

import { Neo4jSelectors as selectors } from '../store';
import { Observable, Subscription } from 'rxjs';
import { getNodeProperties } from '../store/actions';

enum ColumnType {
    EXCLUDE = 'EXCLUDE',
    EDGE = 'EDGE',
    SOURCE = 'SOURCE',
    TARGET = 'TARGET',
    EDGE_PROPERTY = 'EDGE PROPERTY',
}

@Component({
    selector: 'app-import-column-relationship-mapping',
    templateUrl: 'import-column-relationship-mapping.component.html',
    styleUrls: ['import-column-relationship-mapping.component.scss'],
})
export class ImportColumnRelationshipMapperComponent {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;
    @Input() nodeMappingHelper: NodeMappingHelper;
    @Input() columnsForFilePreview: string[];

    relationshipMappingForm: FormGroup;



    // @Output() emitter: EventEmitter<{data: Neo4jColumnMapping, type: string}>;

    // columnMappingForm: FormGroup;
    // nodeType: string;

    // dbNodeTypes$: Observable<string[]>;
    // dbNodeProperties$: Observable<{[key: string]: string[]}>;

    // TODO: add uniqueId column (used for indexing?)
    // readonly columns = [
    //     'columnName',
    //     'mappedNodeType',
    //     'mappedNodeProperty',
    //     'exclude',
    //     'edge',
    //     'source',
    //     'target',
    //     'edgeProperty',
    // ];
    // readonly columnType = ColumnType;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        // this.dbRelationshipTypes$ = this.store.pipe(select(selectors.selectDbRelationshipTypes));
        // this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        // this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));

        // this.columnMappingForm = this.fb.group({ columnMapping: this.fb.array([]) });

        // this.emitter = new EventEmitter<any>();
        // this.columnsForFilePreview = [];
        this.relationshipMappingForm = this.fb.group({relationshipMapping: this.fb.array([])});
    }

    addRelationshipMappingRow() {
        const form = this.relationshipMappingForm.get('relationshipMapping') as FormArray;
        const row = this.fb.group({
            edge: [],
            source: [],
            target: [],
        });
        form.push(row);
    }

    deleteRelationshipMappingRow(idx) {
        (this.relationshipMappingForm.get('relationshipMapping') as FormArray).removeAt(idx);
    }

    createRelationshipMapping() {
        console.log(this.nodeMappingHelper)
        console.log(this.relationshipMappingForm)


    }

    // selectionChange(event: MatSelectChange) {
    //     this.store.dispatch(getNodeProperties({payload: event.value}));
    // }

    // updateColumnMapping(event: MatCheckboxChange, columnType: ColumnType, idx) {
    //     const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
    //     const currentRow = columnMappingFormArray.controls[idx] as FormGroup;

    //     // TODO: how to handle exclude columns mapping?
    //     // if set to source/target/edge/node property -> disable exclude
    //     switch (columnType) {
    //         case ColumnType.EXCLUDE:
    //             if (event.checked) {
    //                 currentRow.controls.exclude.patchValue(true);

    //                 // clear entire row that's excluded
    //                 currentRow.controls.mappedNodeType.patchValue(null);
    //                 currentRow.controls.mappedNodeType.disable();
    //                 currentRow.controls.mappedNodeProperty.patchValue(null);
    //                 currentRow.controls.mappedNodeProperty.disable();
    //                 currentRow.controls.edge.disable();
    //                 currentRow.controls.source.disable();
    //                 currentRow.controls.target.disable();
    //                 currentRow.controls.edgeProperty.disable();
    //             } else {
    //                 currentRow.controls.exclude.patchValue(false);

    //                 currentRow.controls.mappedNodeType.enable();
    //                 currentRow.controls.mappedNodeProperty.enable();
    //                 currentRow.controls.edge.enable();
    //                 currentRow.controls.source.enable();
    //                 currentRow.controls.target.enable();
    //                 currentRow.controls.edgeProperty.enable();
    //             }
    //             break;
    //         case ColumnType.EDGE:
    //             if (event.checked) {
    //                 currentRow.controls.edge.patchValue(true);

    //                 currentRow.controls.mappedNodeType.patchValue(null);
    //                 currentRow.controls.mappedNodeType.disable();
    //                 currentRow.controls.mappedNodeProperty.patchValue(null);
    //                 currentRow.controls.mappedNodeProperty.disable();
    //                 currentRow.controls.exclude.disable();
    //                 currentRow.controls.source.disable();
    //                 currentRow.controls.target.disable();
    //             } else {
    //                 currentRow.controls.edge.patchValue(false);

    //                 currentRow.controls.mappedNodeType.enable();
    //                 currentRow.controls.mappedNodeProperty.enable();
    //                 currentRow.controls.exclude.enable();
    //                 currentRow.controls.source.enable();
    //                 currentRow.controls.target.enable();
    //             }
    //             break;
    //         case ColumnType.SOURCE:
    //             if (event.checked) {
    //                 currentRow.controls.source.patchValue(true);

    //                 currentRow.controls.exclude.disable();
    //                 currentRow.controls.edge.disable();
    //                 currentRow.controls.target.disable();
    //             } else {
    //                 currentRow.controls.source.patchValue(false);

    //                 currentRow.controls.exclude.enable();
    //                 currentRow.controls.edge.enable();
    //                 currentRow.controls.target.enable();
    //             }
    //             break;
    //         case ColumnType.TARGET:
    //             if (event.checked) {
    //                 currentRow.controls.target.patchValue(true);

    //                 currentRow.controls.exclude.disable();
    //                 currentRow.controls.edge.disable();
    //                 currentRow.controls.source.disable();
    //             } else {
    //                 currentRow.controls.target.patchValue(false);

    //                 currentRow.controls.exclude.enable();
    //                 currentRow.controls.edge.enable();
    //                 currentRow.controls.source.enable();
    //             }
    //             break;
    //         case ColumnType.EDGE_PROPERTY:
    //             if (event.checked) {
    //                 currentRow.controls.edgeProperty.patchValue(true);
    //                 currentRow.controls.exclude.disable();
    //             } else {
    //                 currentRow.controls.edgeProperty.patchValue(false);
    //                 currentRow.controls.exclude.enable();
    //             }
    //             break;
    //     }
    // }

    // createColumnMapping() {
    //     const mapping = {
    //         relationship: {
    //             edge: {},
    //             edgeProperty: {},
    //             sourceNode: {
    //                 mappedNodeType: null,
    //                 mappedNodeProperty: {},
    //             },
    //             targetNode: {
    //                 mappedNodeType: null,
    //                 mappedNodeProperty: {},
    //             },
    //         }
    //     } as Neo4jColumnMapping;

    //     const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

    //     columnMappingFormArray.controls.forEach((group: FormGroup) => {
    //         if (group.controls.source.value) {
    //             mapping.relationship.sourceNode.mappedNodeType = group.controls.mappedNodeType.value;
    //             mapping.relationship.sourceNode.mappedNodeProperty[
    //                 Object.values(group.controls.columnName.value)[0] as number
    //             ] = group.controls.mappedNodeProperty.value;
    //         } else if (group.controls.target.value) {
    //             mapping.relationship.targetNode.mappedNodeType = group.controls.mappedNodeType.value;
    //             mapping.relationship.targetNode.mappedNodeProperty[
    //                 Object.values(group.controls.columnName.value)[0] as number
    //             ] = group.controls.mappedNodeProperty.value;
    //         } else if (group.controls.edge.value) {
    //             mapping.relationship.edge = Object.keys(group.controls.columnName.value)[0] as string;
    //         }

    //         if (group.controls.edgeProperty.value) {
    //             mapping.relationship.edgeProperty[
    //                 Object.values(group.controls.columnName.value)[0] as number
    //             ] = Object.keys(group.controls.columnName.value)[0] as string;
    //         }
    //     });

    //     console.log(mapping);
    //     mapping.sheetName = this.chosenSheetToMap.sheetName;
    //     this.emitter.emit({data: mapping, type: 'relationship'});
    // }
}
