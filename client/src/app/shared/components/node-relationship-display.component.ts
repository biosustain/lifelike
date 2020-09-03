import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-node-relationship',
    templateUrl: 'node-relationship-display.component.html',
    styleUrls: ['./node-relationship-display.component.scss']
})
export class NodeRelationshipComponent {
    @Input() leftNodeName: string;
    @Input() leftNodeLabel: string;
    @Input() leftNodeColor = 'automatic';
    @Input() leftNodeUrl: string;
    @Input() rightNodeName: string;
    @Input() rightNodeLabel: string;
    @Input() rightNodeColor = 'automatic';
    @Input() rightNodeUrl: string;
    @Input() edge: string;

    tooltipPosition = 'above';

    constructor() {}
}
