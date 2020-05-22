import { Component, OnInit, Input } from '@angular/core';

import { SidenavClusterEntity } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-cluster-view',
    templateUrl: './sidenav-cluster-view.component.html',
    styleUrls: ['./sidenav-cluster-view.component.scss']
})
export class SidenavClusterViewComponent implements OnInit {
    @Input() clusterEntity: SidenavClusterEntity;
    @Input() legend: Map<string, string[]>;

    constructor() {}

    ngOnInit() {}
}
