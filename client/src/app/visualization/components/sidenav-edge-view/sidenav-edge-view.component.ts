import { Component, OnInit, Input } from '@angular/core';

import { SidenavEdgeEntity } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-edge-view',
    templateUrl: './sidenav-edge-view.component.html',
    styleUrls: ['./sidenav-edge-view.component.scss']
})
export class SidenavEdgeViewComponent implements OnInit {
    @Input() edgeEntity: SidenavEdgeEntity;

    constructor() { }

    ngOnInit() {
    }
}
