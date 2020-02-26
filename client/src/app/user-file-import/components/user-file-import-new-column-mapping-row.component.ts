import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material';

import { Store } from '@ngrx/store';

import { State } from '../../***ARANGO_USERNAME***-store';

import { getNodeProperties } from '../store/actions';
import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';

@Component({
  selector: 'app-user-file-import-new-column-mapping-row',
  templateUrl: 'user-file-import-new-column-mapping-row.component.html'
})
export class UserFileImportNewColumnMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() columnMappingForm: FormGroup;
    @Input() existingNodeLabels: string[];
    @Input() existingNodeProperties: string[];
    @Input() relationshipTypes: string[];

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor(private store: Store<State>) {
      this.deleteMapping = new EventEmitter<boolean>();
    }

    deleteMappingRow() {
      this.deleteMapping.emit(true);
    }

    selectExistingNodeType(event: MatSelectChange) {
      this.store.dispatch(getNodeProperties({payload: event.value}));
    }
}
