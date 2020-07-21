import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

import { isNullOrUndefined } from 'util';

import { SheetNameAndColumnNames } from 'app/interfaces';
import { getRandomColor } from 'app/shared/utils';

enum GeneMatchingPropertyType {
    ID = 'ID',
    NAME = 'Name',
}

@Component({
  selector: 'app-gene-import-config',
  templateUrl: './gene-import-config.component.html',
  styleUrls: ['./gene-import-config.component.scss']
})
export class GeneImportConfigComponent {
    @Output() relationshipsChanged: EventEmitter<FormGroup[]>;
    @Output() relationshipFormValidityChanged: EventEmitter<boolean>;
    @Input() set worksheetData(worksheetData: SheetNameAndColumnNames) {
        if (!isNullOrUndefined(worksheetData)) {
            this.resetForm();

            worksheetData.sheetColumnNames.forEach((column, index) => {
                this.columns.push(Object.keys(column)[0]);
                this.indexToColumn.set(index.toString(), Object.keys(column)[0]);
            });
            // 'KG Gene' should always be the last element of the list
            this.columns.push('KG Gene');
            this.indexToColumn.set(worksheetData.sheetColumnNames.length.toString(), 'KG Gene');
        }
    }

    readonly geneMatchingPropertyEnum = GeneMatchingPropertyType;

    labelColors: Map<string, string>;

    editingRelationship: boolean;
    columns: string[];
    indexToColumn: Map<string, string>;
    prevColumn2Selection: string;

    activeFormGroup: FormGroup;
    relationshipFormGroupArray: FormGroup[];

    // TEMP
    organisms: Map<string, number>;

    constructor(
        private fb: FormBuilder
    ) {
        this.relationshipsChanged = new EventEmitter<FormGroup[]>();
        this.relationshipFormValidityChanged = new EventEmitter<boolean>();

        this.organisms = new Map<string, number>([
            ['Homo sapiens', 78602],
            ['SARS-CoV-2', 2697049],
            ['Escherichia coli str. K-12 substr. MG1655', 29424357],
            ['Saccharomyces cerevisiae S288C', 29816395],
            ['Pseudomonas aeruginosa PAO1', 29434923],
            ['Clostridioides difficile 630', 29605729],
        ]);

        this.resetForm();
    }

    /**
     * Completely resets all form related objects. This is always done when the component
     * is first initialized, but also whenever the user changes the current worksheet.
     */
    resetForm() {
        this.columns = [];
        this.indexToColumn = new Map<string, string>();
        this.editingRelationship = false;
        this.relationshipFormGroupArray = [];
        this.activeFormGroup = null;
        this.labelColors = new Map<string, string>();
        this.prevColumn2Selection = '';
    }

    addRelationship() {
        this.activeFormGroup = this.fb.group({
            columnIndex1: ['', Validators.required],
            columnIndex2: ['', Validators.required],
            nodeLabel1: ['', Validators.required],
            nodeLabel2: ['', Validators.required],
            nodeProperties1: this.fb.array([]),
            nodeProperties2: this.fb.array([]),
            relationshipLabel: ['', Validators.required],
            useExistingRel: [true, Validators.required],
            relationshipDirection: ['', Validators.required],
            relationshipProperties: this.fb.array([]),
            speciesSelection: [null],
            geneMatchingProperty: [null],
        });

        this.editingRelationship = true;
        this.relationshipFormValidityChanged.emit(false);
    }

    removeRelationship(index: number) {
        this.relationshipFormGroupArray.splice(index, 1);
        this.relationshipsChanged.emit(this.relationshipFormGroupArray);

        // Only set form validity to true if there is at least one relationship remaining.
        this.relationshipFormValidityChanged.emit(this.relationshipFormGroupArray.length > 0);
    }

    /**
     * Sets the active form group to the selected index. This will remove that form from the array until
     * the user submits the form again.
     * @param index array index of the form to be edited
     */
    editRelationship(index: number) {
        this.editingRelationship = true;
        this.activeFormGroup = this.relationshipFormGroupArray[index];
        this.removeRelationship(index);

        this.relationshipsChanged.emit(this.relationshipFormGroupArray);
        this.relationshipFormValidityChanged.emit(false);
    }

    /**
     * Resets the 'speciesSelection' and 'geneMatchingProperty' controls whenever the 'columnIndex2'
     * selection changes. The former two controls are required if the user is matching to KG
     * genes, and here we set their values/validators accordingly.
     */
    columnSelection2Changed() {
        const speciesSelectionControl = this.activeFormGroup.get('speciesSelection');
        const geneMatchingPropertyControl = this.activeFormGroup.get('geneMatchingProperty');

        if (this.indexToColumn.get(this.activeFormGroup.get('columnIndex2').value) === 'KG Gene') {
            this.activeFormGroup.get('nodeLabel2').setValue('Gene');
            this.activeFormGroup.get('nodeLabel2').disable();

            speciesSelectionControl.setValue('');
            speciesSelectionControl.setValidators([Validators.required]);
            geneMatchingPropertyControl.setValue('');
            geneMatchingPropertyControl.setValidators([Validators.required]);
        } else if (this.prevColumn2Selection === 'KG Gene') {
            this.activeFormGroup.get('nodeLabel2').setValue('');
            this.activeFormGroup.get('nodeLabel2').enable();

            speciesSelectionControl.setValue(null);
            speciesSelectionControl.setValidators([]);
            geneMatchingPropertyControl.setValue(null);
            geneMatchingPropertyControl.setValidators([]);
        }

        this.prevColumn2Selection = this.indexToColumn.get(this.activeFormGroup.get('columnIndex2').value);
    }

    /**
     * Resets the relationship label when the "Existing Relationship" checkbox is checked/unchecked.
     */
    existingRelCheckboxChanged() {
        this.activeFormGroup.get('relationshipLabel').setValue('');
    }

    addProperty(propertyFormArray: string) {
        (this.activeFormGroup.get(propertyFormArray) as FormArray).push(
            this.fb.group({
                column: ['', Validators.required],
                propertyName: ['', Validators.required],
            })
        );
    }

    removeProperty(index: number, propertyFormArray: string) {
        (this.activeFormGroup.get(propertyFormArray) as FormArray).removeAt(index);
    }

    /**
     * Discards the active form group, and if the active group was an element of the
     * relationship form group array removes it from there as well.
     */
    discardRelationship() {
        this.editingRelationship = false;
        this.activeFormGroup = null;

        // Only set form validity to true if there is at least one relationship remaining.
        this.relationshipFormValidityChanged.emit(this.relationshipFormGroupArray.length > 0);
    }

    submitRelationship() {
        if (this.activeFormGroup.valid) {
            this.editingRelationship = false;
            this.relationshipFormGroupArray.push(this.activeFormGroup);

            // Create a new label color if we haven't seen these labels yet
            const nodeLabel1 = this.activeFormGroup.get('nodeLabel1').value;
            const nodeLabel2 = this.activeFormGroup.get('nodeLabel2').value;
            if (!this.labelColors.has(nodeLabel1)) {
                this.labelColors.set(this.activeFormGroup.get('nodeLabel1').value, getRandomColor());
            }

            if (!this.labelColors.has(nodeLabel2)) {
                this.labelColors.set(this.activeFormGroup.get('nodeLabel2').value, getRandomColor());
            }
            this.relationshipFormValidityChanged.emit(true);
            this.relationshipsChanged.emit(this.relationshipFormGroupArray);
        }
    }
}
