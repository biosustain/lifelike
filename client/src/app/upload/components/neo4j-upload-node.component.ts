import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { MatCheckboxChange, MatSelectChange } from '@angular/material';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { Store, select } from '@ngrx/store';

import { SheetNameAndColumnNames, Neo4jColumnMapping } from '../../interfaces/neo4j.interface';

import { State } from '../../***ARANGO_USERNAME***-store';

import { Neo4jSelectors as selectors } from '../store';
import { Observable } from 'rxjs';
import { getNodeProperties } from '../store/actions';

enum ColumnType {
    EXCLUDE = 'EXCLUDE',
    NODE_PROPERTY = 'NODE PROPERTY',
    UNIQUE = 'UNIQUE',
}

@Component({
    selector: 'app-neo4j-upload-node',
    templateUrl: 'neo4j-upload-node.component.html',
    styleUrls: ['neo4j-upload-node.component.sass'],
})
export class Neo4jUploadNodeComponent implements OnChanges {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;

    @Output() emitter: EventEmitter<{data: Neo4jColumnMapping, type: string}>;

    columnMappingForm: FormGroup;
    nodeType: string;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;

    // TODO: add uniqueId column (used for indexing?)
    readonly columns = [
        'columnName',
        'mappedNodeType',
        'mappedNodeProperty',
        'exclude',
        'unique',
        'nodeProperty',
    ];
    readonly columnType = ColumnType;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));

        this.columnMappingForm = this.fb.group({ columnMapping: this.fb.array([]) });

        this.emitter = new EventEmitter<any>();
        this.nodeType = '';
    }

    ngOnChanges() {
        if (this.chosenSheetToMap) {
            const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
            this.chosenSheetToMap.sheetColumnNames.forEach(name => {
                columnMappingFormArray.push(
                    this.fb.group({
                        columnName: [name],
                        mappedNodeType: [''],
                        mappedNodeProperty: [''],
                        exclude: [false],
                        unique: [false],
                        nodeProperty: [''],
                    }),
                );
            });
        }
    }

    selectionChange(event: MatSelectChange) {
        this.store.dispatch(getNodeProperties({payload: event.value}));
    }

    updateColumnMapping(event: MatCheckboxChange, columnType: ColumnType, idx) {
        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
        const currentRow = columnMappingFormArray.controls[idx] as FormGroup;

        switch (columnType) {
            case ColumnType.EXCLUDE:
                if (event.checked) {
                    currentRow.controls.exclude.patchValue(true);

                    // clear entire row that's excluded
                    currentRow.controls.mappedNodeType.patchValue(null);
                    currentRow.controls.mappedNodeType.disable();
                    currentRow.controls.mappedNodeProperty.patchValue(null);
                    currentRow.controls.mappedNodeProperty.disable();
                } else {
                    currentRow.controls.exclude.patchValue(false);

                    currentRow.controls.mappedNodeType.enable();
                    currentRow.controls.mappedNodeProperty.enable();
                }
                break;
            case ColumnType.NODE_PROPERTY:
                if (event.checked) {
                    currentRow.controls.nodeProperty.patchValue(true);
                    currentRow.controls.exclude.disable();
                } else {
                    currentRow.controls.tgtNodeProperty.patchValue(false);
                    currentRow.controls.exclude.enable();
                }
                break;
        }
    }

    createColumnMapping() {
        const mapping = {
            node: {
                nodeType: this.nodeType,
                mappedNodeType: null,
                nodeProperties: {},
                mappedNodeProperty: {},
                uniqueProperty: null,
            },
        } as Neo4jColumnMapping;

        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            if (group.controls.mappedNodeType.value) {
                // only one column should be mapped to a KG graph node type
                mapping.node.mappedNodeType = group.controls.mappedNodeType.value;
            }

            if (group.controls.mappedNodeProperty.value) {
                // only one column should be mapped to a KG graph node type property
                mapping.node.mappedNodeProperty = group.controls.mappedNodeProperty.value;
            }

            if (group.controls.nodeProperty.value) {
                if (group.controls.mappedNodeProperty.value) {
                    // if the property is from a column that was mapped
                    // to a KG node property
                    // then use that node property
                    mapping.node.nodeProperties[
                        Object.values(group.controls.columnName.value)[0] as number
                    ] = group.controls.mappedNodeProperty.value;
                } else {
                    // use the column header as property
                    mapping.node.nodeProperties[
                        Object.values(group.controls.columnName.value)[0] as number
                    ] = Object.keys(group.controls.columnName.value)[0] as string;
                }
            }

            if (group.controls.unique.value) {
                if (group.controls.mappedNodeProperty.value) {
                    // if the property is from a column that was mapped
                    // to a KG node property
                    // then use that node property
                    mapping.node.uniqueProperty = group.controls.mappedNodeProperty.value;
                } else {
                    // use the column header as property
                    mapping.node.uniqueProperty = Object.keys(group.controls.columnName.value)[0] as string;
                }
            }
        });

        console.log(mapping);
        mapping.sheetName = this.chosenSheetToMap.sheetName;
        this.emitter.emit({data: mapping, type: 'node'});
    }
}
