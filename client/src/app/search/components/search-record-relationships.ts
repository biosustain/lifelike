import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';

@Component({
    selector: 'app-search-record-relationships',
    template: `
        <mat-card class="mat-elevation-z0 flat-record-card">
            <mat-card-title>Literature Reference</mat-card-title>
            <mat-card-subtitle>ID: {{ node.node.data.id }}</mat-card-subtitle>
        </mat-card>
    `,
    styleUrls: ['./search-record.component.scss']
})
export class SearchRecordRelationshipsComponent {
    @Input() node: FTSQueryRecord;

    constructor() {}
}
