import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';

@Component({
    selector: 'app-search-record-node',
    templateUrl: 'search-record-node.component.html',
    styleUrls: ['./search-record-node.component.scss']
})
export class SearchRecordNodeComponent {

    // TODO: We should come up with a consistent way to mark variables as private without using '_', or
    // just disable that check for tslint.
    private prvNode: FTSQueryRecord;
    nodeURL: string;

    @Input() legend: Map<string, string>;
    @Input()
    set node(n: FTSQueryRecord) {
        this.prvNode = n;
        this.nodeURL = stringToHex(n.node.id.toString());
    }

    get node(): FTSQueryRecord {
        return this.prvNode;
    }

    constructor() {}
}
