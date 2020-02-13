import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-import-column-mapping-relationship-row',
  templateUrl: 'import-column-mapping-relationship-row.component.html'
})
export class ImportColumnMappingRelationshipRowComponent implements OnChanges {
    @Input() columnHeaders: string[];
    @Input() columnMappingForm: FormGroup;
    @Input() existingNodeLabels: string[];
    @Input() existingNodeProperties: string[];

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor() {
      this.deleteMapping = new EventEmitter<boolean>();
    }

    ngOnChanges() {
      console.log(this.columnMappingForm)
    }

    deleteMappingRow() {
      this.deleteMapping.emit(true);
    }
}
