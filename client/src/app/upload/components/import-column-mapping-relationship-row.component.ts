import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-import-column-mapping-relationship-row',
  templateUrl: 'import-column-mapping-relationship-row.component.html'
})
export class ImportColumnMappingRelationshipRowComponent {
    @Input() columnHeaders: string[];
    @Input() columnMappingForm: FormGroup;
    @Input() existingNodeLabels: string[];
    @Input() existingNodeProperties: string[];

    constructor() {}
}
