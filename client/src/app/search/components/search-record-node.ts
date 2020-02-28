import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';

@Component({
    selector: 'app-search-record-node',
    template: `
    <mat-card class="mat-elevation-z1">
        <mat-card-title>{{ node.node.label }}</mat-card-title>
        <mat-card-subtitle>ID: {{ node.node.data.id }}</mat-card-subtitle>
        <mat-card-content>{{ node.node.displayName }}</mat-card-content>
    </mat-card>
    `
})
export class SearchRecordNodeComponent {
    @Input() node: FTSQueryRecord;

    constructor() {}
}
