import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { ColumnNameIndex } from 'src/app/interfaces';

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
}

