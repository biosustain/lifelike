import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';

@Component({
    selector: 'app-search-record-node',
    template: `
    <mat-card class="mat-elevation-z1">
        <mat-card-title>
            <a class='node-url'
               [routerLink]="['/neo4j-visualizer']"
               [queryParams]="{ data: nodeURL }"
            >
            {{ node.node.label }}
            </a>
        </mat-card-title>
        <mat-card-subtitle>ID: {{ node.node.data.id }}</mat-card-subtitle>
        <mat-card-content>{{ node.node.displayName }}</mat-card-content>
    </mat-card>
    `,
    styleUrls: ['./search-record.component.scss']
})
export class SearchRecordNodeComponent {

    private _node: FTSQueryRecord;
    nodeURL: string;

    @Input()
    set node(n: FTSQueryRecord) {
        this._node = n;
        this.nodeURL = stringToHex(n.node.id.toString());
    }

    get node(): FTSQueryRecord {
        return this._node;
    }

    constructor() {}
}
