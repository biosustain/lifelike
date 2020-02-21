import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { ColumnNameIndex } from '../../interfaces/user-file-import.interface';


@Component({
  selector: 'app-user-file-import-column-relationship-mapping-row',
  templateUrl: 'user-file-import-column-relationship-mapping-row.component.html'
})
export class UserFileImportColumnRelationshipMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() relationshipMappingForm: FormGroup;

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor() {
      this.deleteMapping = new EventEmitter<boolean>();
    }

    deleteMappingRow() {
      this.deleteMapping.emit(true);
    }
}

