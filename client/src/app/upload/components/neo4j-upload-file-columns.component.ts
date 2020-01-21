import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { MatCheckboxChange } from '@angular/material';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { SheetNameAndColumnNames, Neo4jColumnMapping } from '../../interfaces/neo4j.interface';

enum ColumnType {
    EXCLUDE = 'EXCLUDE',
    EDGE = 'EDGE',
    SOURCE = 'SOURCE',
    TARGET = 'TARGET',
    NODE_PROPERTY = 'NODE PROPERTY',
}

@Component({
    selector: 'app-neo4j-upload-file-columns',
    templateUrl: 'neo4j-upload-file-columns.component.html',
    styleUrls: ['neo4j-upload-file-columns.component.sass'],
})
export class Neo4jUploadFileColumnsComponent implements OnChanges {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;

    @Output() emitter: EventEmitter<Neo4jColumnMapping>;

    columnMappingForm: FormGroup;

    existingNodeLabels: string[];
    existingPropertyLabels: string[];

    // TODO: add uniqueId column (used for indexing?)
    readonly columns = [
        'columnName', 'nodeLabel', 'propertyLabel', 'exclude', 'edge', 'source', 'target', 'nodeProperty'];      // table column headers
    readonly columnType = ColumnType;

    constructor(private fb: FormBuilder) {
        this.existingNodeLabels = ['Ecocyc', 'Drug'];
        this.existingPropertyLabels = ['common_name', 'name', 'conservation', 'percent_strain'];
        this.columnMappingForm = this.fb.group({ columnMapping: this.fb.array([]) });

        this.emitter = new EventEmitter<any>();
    }

    ngOnChanges() {
        if (this.chosenSheetToMap) {
            const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
            this.chosenSheetToMap.sheetColumnNames.forEach(name => {
                columnMappingFormArray.push(
                    this.fb.group({
                        columnName: [name],
                        nodeLabel: [],
                        propertyLabel: [],
                        // uniqueId: [],
                        exclude: [false],
                        edge: [false],
                        source: [false],
                        target: [false],
                        nodeProperty: [false],
                    }),
                );
            });
        }
    }

    updateColumnMapping(event: MatCheckboxChange, columnType: ColumnType, idx) {
        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;
        const currentRow = columnMappingFormArray.controls[idx] as FormGroup;

        // TODO: how to handle exclude columns mapping?
        // if set to source/target/edge/node property -> disable exclude
        switch (columnType) {
            case ColumnType.EXCLUDE:
                if (event.checked) {
                    currentRow.controls.exclude.patchValue(true);
                } else {
                    currentRow.controls.exclude.patchValue(false);
                }
                break;
            case ColumnType.EDGE:
                if (event.checked) {
                    currentRow.controls.edge.patchValue(true);
                    currentRow.controls.nodeLabel.patchValue(null);
                    currentRow.controls.nodeLabel.disable();
                    currentRow.controls.source.disable();
                    currentRow.controls.target.disable();
                    currentRow.controls.nodeProperty.disable();
                } else {
                    currentRow.controls.edge.patchValue(false);
                    currentRow.controls.nodeLabel.enable();
                    currentRow.controls.source.enable();
                    currentRow.controls.target.enable();
                    currentRow.controls.nodeProperty.enable();
                }
                break;
            case ColumnType.SOURCE:
                if (event.checked) {
                    currentRow.controls.source.patchValue(true);
                    currentRow.controls.edge.disable();
                    currentRow.controls.target.disable();
                    // currentRow.controls.nodeProperty.disable();
                } else {
                    currentRow.controls.source.patchValue(false);
                    currentRow.controls.edge.enable();
                    currentRow.controls.target.enable();
                    // currentRow.controls.nodeProperty.enable();
                }
                break;
            case ColumnType.TARGET:
                if (event.checked) {
                    currentRow.controls.target.patchValue(true);
                    currentRow.controls.edge.disable();
                    currentRow.controls.source.disable();
                    // currentRow.controls.nodeProperty.disable();
                } else {
                    currentRow.controls.target.patchValue(false);
                    currentRow.controls.edge.enable();
                    currentRow.controls.source.enable();
                    // currentRow.controls.nodeProperty.enable();
                }
                break;
            case ColumnType.NODE_PROPERTY:
                if (event.checked) {
                    // currentRow.controls.nodeProperty.patchValue(true);
                    // currentRow.controls.nodeLabel.patchValue(null);
                    // currentRow.controls.nodeLabel.disable();
                    currentRow.controls.edge.disable();
                    // currentRow.controls.source.disable();
                    // currentRow.controls.target.disable();
                } else {
                    // currentRow.controls.nodeProperty.patchValue(false);
                    // currentRow.controls.nodeLabel.enable();
                    currentRow.controls.edge.enable();
                    // currentRow.controls.source.enable();
                    // currentRow.controls.target.enable();
                }
                break;
        }
    }

    createColumnMapping() {
        // const nodeProperties = [];
        const columnMapping = {
            sourceNode: { nodeLabel: {}, nodeProperties: {} },
            targetNode: { nodeLabel: {}, nodeProperties: {} },
            edge: null,
        } as Neo4jColumnMapping;
        const columnMappingFormArray = this.columnMappingForm.get('columnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            if (group.controls.source.value) {
                columnMapping.sourceNode.nodeLabel[
                    Object.values(group.controls.columnName.value)[0] as number] = group.controls.nodeLabel.value;
            } else if (group.controls.target.value) {
                columnMapping.targetNode.nodeLabel[
                    Object.values(group.controls.columnName.value)[0] as number] = group.controls.nodeLabel.value;
            } else if (group.controls.edge.value) {
                columnMapping.edge = Object.values(group.controls.columnName.value)[0] as number;
            }

            if (group.controls.nodeProperty.value) {
                // nodeProperties.push(<number>Object.values(group.controls.columnName.value)[0]);
                if (group.controls.target.value) {
                    columnMapping.targetNode.nodeProperties[
                        Object.values(group.controls.columnName.value)[0] as number] = group.controls.propertyLabel.value;
                } else {
                    columnMapping.sourceNode.nodeProperties[
                        Object.values(group.controls.columnName.value)[0] as number] = group.controls.propertyLabel.value;
                }
            }
        });

        console.log(columnMapping);
        columnMapping.sheetName = this.chosenSheetToMap.sheetName;
        this.emitter.emit(columnMapping);
    }
}
