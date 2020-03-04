import { Component, Input, OnInit } from '@angular/core';
import { GraphNode } from 'app/interfaces';

@Component({
    selector: 'app-node-relationship',
    template: `
        <div id="node-relationship-container">
            <div class="node-detail" id="left-node-container" *ngIf="leftNode">
                <div
                    class="node-detail-container"
                    matTooltip="{{ leftNode.label }}"
                    [matTooltipPosition]="tooltipPosition"
                >
                    <mat-icon [ngStyle]="{'color': leftNodeColor}">lens</mat-icon>
                    {{ leftNode.displayName }}
                </div>
            </div>
            <div id="relationship-container" *ngIf="edge">
                <div><i class="material-icons">remove</i></div>
                <div>{{ edge }}</div>
                <div *ngIf="rightNode"><i class="material-icons">arrow_forward</i></div>
            </div>
            <div class="node-detail" id="right-node-container" *ngIf="rightNode">
                <div
                    class="node-detail-container"
                    matTooltip="{{ rightNode.label }}"
                    [matTooltipPosition]="tooltipPosition"
                >
                    <mat-icon [style.color]="rightNodeColor">lens</mat-icon>
                    {{ rightNode.displayName }}
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./node-relationship-display.component.scss']
})
export class NodeRelationshipComponent {
    @Input() leftNode: GraphNode;
    @Input() rightNode: GraphNode;
    @Input() leftNodeColor = 'automatic';
    @Input() rightNodeColor = 'automatic';
    @Input() edge: string;

    tooltipPosition = 'above';

    constructor() {}
}
