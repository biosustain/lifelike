import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-node-relationship',
    templateUrl: 'node-relationship-display.component.html',
    styleUrls: ['./node-relationship-display.component.scss']
})
export class NodeRelationshipComponent {
    @Input() leftNodeName: string;
    @Input() leftNodeLabel: string;
    @Input() rightNodeName: string;
    @Input() rightNodeLabel: string;
    @Input() leftNodeColor = 'automatic';
    @Input() rightNodeColor = 'automatic';
    @Input() edge: string;

    tooltipPosition = 'above';

    constructor() {}
}
