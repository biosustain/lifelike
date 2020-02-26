import { Component, Input, Output, EventEmitter, ViewChild, ElementRef} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material';

import { Store } from '@ngrx/store';

import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';

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

    @ViewChild('newRelationshipInput', {static: false}) newRelationshipInput: ElementRef;

    disableRelationshipDropdown: boolean;

    constructor(private store: Store<State>) {
        this.deleteMapping = new EventEmitter<boolean>();
        this.disableRelationshipDropdown = false;
    }

    deleteMappingRow() {
        this.deleteMapping.emit(true);
    }

    selectExistingNodeType(event: MatSelectChange) {
        this.store.dispatch(getNodeProperties({payload: event.value}));
    }

    relationshipInputChange() {
        this.disableRelationshipDropdown = (this.newRelationshipInput.nativeElement as HTMLInputElement).value ? true : false;
    }
}

