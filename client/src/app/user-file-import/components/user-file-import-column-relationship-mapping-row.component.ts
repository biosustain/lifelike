import { Component, Input, Output, EventEmitter} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material';

import { Store } from '@ngrx/store';

import { ColumnNameIndex } from '../../interfaces/user-file-import.interface';

import { State } from '../../root-store';

import { getNodeProperties } from '../store/actions';

@Component({
  selector: 'app-user-file-import-column-relationship-mapping-row',
  templateUrl: 'user-file-import-column-relationship-mapping-row.component.html'
})
export class UserFileImportColumnRelationshipMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() relationshipMappingForm: FormGroup;
    @Input() dbNodeTypes: string[];
    @Input() existingNodeProperties: string[];

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

