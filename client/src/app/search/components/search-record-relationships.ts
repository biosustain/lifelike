import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';
import { PubMedURL } from 'app/shared/constants';

@Component({
    selector: 'app-search-record-relationships',
    template: `
        <mat-card class="mat-elevation-z1">
            <mat-card-title>Snippet: {{ node.node.displayName }}</mat-card-title>
            <mat-card-subtitle>ID: {{ node.node.data.id }}</mat-card-subtitle>
            <mat-card-content>
                <div id="pub-snippet-title">{{ node.node.displayName }}</div>
                <i *ngIf="node.chemical || node.disease">This snippet genarated the following relationship</i>
                <app-node-relationship
                    [leftNode]="node.chemical"
                    [leftNodeColor]="'rgb(143, 166, 203)'"
                    [rightNodeColor]="'rgb(205, 93, 103)'"
                    [rightNode]="node.disease"
                    [edge]="node.relationship"
                >
                </app-node-relationship>
                <div id="publication-container">
                    <div>
                        <span id="pub-data-header">Publication:</span>
                        <a target="_blank" href="{{ PUBMEDURL }}/{{ node.publicationId }}">
                            <span>{{ node.publicationTitle }}</span>
                            <span *ngIf="node.publicationYear">({{ node.publicationYear }})</span>
                        </a>
                        <span id="pubid-data-header">PubMed ID:</span>
                        <a target="_blank" href="{{ PUBMEDURL }}/{{ node.publicationId }}">
                            <span>{{ node.publicationId }}</span>
                        </a>
                    </div>
                </div>
            </mat-card-content>
        </mat-card>
    `,
    styleUrls: ['./search-record.component.scss']
})
export class SearchRecordRelationshipsComponent {

    PUBMEDURL: string = PubMedURL;

    @Input() node: FTSQueryRecord;

    constructor() {}
}
