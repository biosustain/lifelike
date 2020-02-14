import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { ColumnNameIndex } from 'src/app/interfaces';


@Component({
  selector: 'app-import-column-relationship-mapping-row',
  templateUrl: 'import-column-relationship-mapping-row.component.html'
})
export class ImportColumnRelationshipMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() relationshipTypes: string[];
    @Input() relationshipMappingForm: FormGroup;

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor() {
      this.deleteMapping = new EventEmitter<boolean>();
    }

    deleteMappingRow() {
      this.deleteMapping.emit(true);
    }
}

