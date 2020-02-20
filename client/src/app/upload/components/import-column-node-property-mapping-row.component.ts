import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormArray } from '@angular/forms';

import { ColumnNameIndex } from 'src/app/interfaces';
import { MatCheckboxChange } from '@angular/material';

@Component({
  selector: 'app-import-column-node-property-mapping-row',
  templateUrl: 'import-column-node-property-mapping-row.component.html'
})
export class ImportColumnNodePropertyMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() nodePropertyMappingForm: FormGroup;

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor() {
      this.deleteMapping = new EventEmitter<boolean>();
    }

    deleteMappingRow() {
      this.deleteMapping.emit(true);
    }

    setUnique(event: MatCheckboxChange) {
      // console.log(this.nodePropertyMappingForm)
      const nodePropertyControl = this.nodePropertyMappingForm.get('nodeProperty') as FormArray;
      const uniqueControl = this.nodePropertyMappingForm.get('unique') as FormArray;
      // console.log(columnMappingFormArray)
      // const currentRow = columnMappingFormArray.controls[idx] as FormGroup;
      if (event.checked) {
        // this.nodePropertyMappingForm.controls.unique.value = ''
        console.log(nodePropertyControl)
        console.log(Object.keys(nodePropertyControl.value)[0])
        this.nodePropertyMappingForm.patchValue({unique: Object.keys(nodePropertyControl.value)[0]});
      }
      console.log(this.nodePropertyMappingForm)
    }
}

