import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';

@Component({
    selector: 'app-search-record-relationships',
    template: `
        <mat-card class="mat-elevation-z1">
            <mat-card-title>{{ node.node.label }}</mat-card-title>
        </mat-card>
    `,
})
export class SearchRecordRelationshipsComponent {
    @Input() node: FTSQueryRecord;

    constructor() {}
}
