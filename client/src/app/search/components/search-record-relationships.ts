import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';

@Component({
    selector: 'app-search-record-relationships',
    template: `
        <mat-card class="mat-elevation-z1">
            <mat-card-title>Snippet: {{ node.node.displayName }}</mat-card-title>
            <mat-card-subtitle>ID: {{ node.node.data.id }}</mat-card-subtitle>
            <mat-card-content>
                <div>{{ node.node.displayName }}</div>
                <div id="publication-container">
                    <div>
                        <span id="pub-data-header">Publication:</span>
                        <span>{{ node.publicationTitle }}</span>
                        <span *ngIf="node.publicationYear">({{ node.publicationYear }})</span>
                        <span id="pubid-data-header">PubMed ID:</span>
                        <span>{{ node.publicationId }}</span>
                    </div>
                </div>
            </mat-card-content>
        </mat-card>
    `,
    styleUrls: ['./search-record.component.scss']
})
export class SearchRecordRelationshipsComponent {
    @Input() node: FTSQueryRecord;

    constructor() {}
}
