import { Component, Input } from '@angular/core';
import { GraphNode } from 'app/interfaces';

@Component({
    selector: 'app-node-relationship',
    templateUrl: '/node-relationship-display.component.html',
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
