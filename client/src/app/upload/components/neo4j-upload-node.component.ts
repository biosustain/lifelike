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
    DOMAIN_NAME = 'DOMAIN_NAME',
    EDGE = 'EDGE',
    SOURCE = 'SOURCE',
    TARGET = 'TARGET',
    EDGE_PROPERTY = 'EDGE PROPERTY',
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
    // nodeType: string;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;

    // TODO: add uniqueId column (used for indexing?)
    readonly columns = [
        'columnName',
        'domainName',
        'mappedNodeType',
        'mappedNodeProperty',
        'exclude',
        'unique',
        'edge',
        'source',
        'target',
        'edgeProperty',
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
        // this.nodeType = '';
    }

    ngOnChanges() {
        if (this.chosenSheetToMap) {
            const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
            this.chosenSheetToMap.sheetColumnNames.forEach(name => {
                columnMappingFormArray.push(
                    this.fb.group({
                        columnName: [name],
                        domainName: [''],
                        mappedNodeType: [''],
                        mappedNodeProperty: [''],
                        exclude: [false],
                        unique: [false],
                        edge: [false],
                        source: [false],
                        target: [false],
                        edgeProperty: [''],
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
                    currentRow.controls.edge.disable();
                    currentRow.controls.source.disable();
                    currentRow.controls.target.disable();
                    currentRow.controls.edgeProperty.disable();
                } else {
                    currentRow.controls.exclude.patchValue(false);

                    currentRow.controls.mappedNodeType.enable();
                    currentRow.controls.mappedNodeProperty.enable();
                    currentRow.controls.edge.enable();
                    currentRow.controls.source.enable();
                    currentRow.controls.target.enable();
                    currentRow.controls.edgeProperty.enable();
                }
                break;
            case ColumnType.EDGE:
                if (event.checked) {
                    currentRow.controls.edge.patchValue(true);

                    currentRow.controls.mappedNodeType.patchValue(null);
                    currentRow.controls.mappedNodeType.disable();
                    currentRow.controls.mappedNodeProperty.patchValue(null);
                    currentRow.controls.mappedNodeProperty.disable();
                    currentRow.controls.exclude.disable();
                    currentRow.controls.source.disable();
                    currentRow.controls.target.disable();
                } else {
                    currentRow.controls.edge.patchValue(false);

                    currentRow.controls.mappedNodeType.enable();
                    currentRow.controls.mappedNodeProperty.enable();
                    currentRow.controls.exclude.enable();
                    currentRow.controls.source.enable();
                    currentRow.controls.target.enable();
                }
                break;
            case ColumnType.SOURCE:
                if (event.checked) {
                    currentRow.controls.source.patchValue(true);

                    currentRow.controls.exclude.disable();
                    currentRow.controls.edge.disable();
                    currentRow.controls.target.disable();
                } else {
                    currentRow.controls.source.patchValue(false);

                    currentRow.controls.exclude.enable();
                    currentRow.controls.edge.enable();
                    currentRow.controls.target.enable();
                }
                break;
            case ColumnType.TARGET:
                if (event.checked) {
                    currentRow.controls.target.patchValue(true);

                    currentRow.controls.exclude.disable();
                    currentRow.controls.edge.disable();
                    currentRow.controls.source.disable();
                } else {
                    currentRow.controls.target.patchValue(false);

                    currentRow.controls.exclude.enable();
                    currentRow.controls.edge.enable();
                    currentRow.controls.source.enable();
                }
                break;
            case ColumnType.EDGE_PROPERTY:
                if (event.checked) {
                    currentRow.controls.edgeProperty.patchValue(true);
                    currentRow.controls.exclude.disable();
                } else {
                    currentRow.controls.edgeProperty.patchValue(false);
                    currentRow.controls.exclude.enable();
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

    // updateDomainNameInput(columnType: ColumnType, idx) {
    //     console.log(event);
    //     console.log(this.columnMappingForm)

    // }

    createColumnMapping() {
        const mapping = {
            // node is the nodes to create
            // usually the column that gets domain name
            node: {
                nodeType: null,
                mappedNodeType: null,
                nodeProperties: {},
                mappedNodeProperty: {},
                uniqueProperty: null,
            },
            relationship: {
                edge: null,
                edgeProperty: {},
                sourceNode: {
                    mappedNodeType: null,
                    mappedNodeProperty: {},
                },
                targetNode: {
                    mappedNodeType: null,
                    mappedNodeProperty: {},
                },
            }
        } as Neo4jColumnMapping;





        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            if (group.controls.domainName.value) {
                mapping.node.nodeType = group.controls.domainName.value;
                // domain name has value
                // means new domain to create
                // so new nodes need to be created too
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
                    // unique property will be used to filter and get node in backend
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
            }

            // relationship mapping
            if (group.controls.source.value) {
                if (group.controls.domainName.value) {
                    mapping.relationship.sourceNode.mappedNodeType = group.controls.domainName.value;
                    mapping.relationship.sourceNode.mappedNodeProperty[
                        Object.values(group.controls.columnName.value)[0] as number
                    ] = Object.keys(group.controls.columnName.value)[0] as string;
                } else {
                    mapping.relationship.sourceNode.mappedNodeType = group.controls.mappedNodeType.value;
                    mapping.relationship.sourceNode.mappedNodeProperty[
                        Object.values(group.controls.columnName.value)[0] as number
                    ] = group.controls.mappedNodeProperty.value;
                }
            } else if (group.controls.target.value) {
                mapping.relationship.targetNode.mappedNodeType = group.controls.mappedNodeType.value;
                mapping.relationship.targetNode.mappedNodeProperty[
                    Object.values(group.controls.columnName.value)[0] as number
                ] = group.controls.mappedNodeProperty.value;
            } else if (group.controls.edge.value) {
                mapping.relationship.edge = Object.keys(group.controls.columnName.value)[0] as string;
            }

            if (group.controls.edgeProperty.value) {
                mapping.relationship.edgeProperty[
                    Object.values(group.controls.columnName.value)[0] as number
                ] = Object.keys(group.controls.columnName.value)[0] as string;
            }
        });

        console.log(mapping);
        mapping.sheetName = this.chosenSheetToMap.sheetName;
        this.emitter.emit({data: mapping, type: 'node'});
    }
}
