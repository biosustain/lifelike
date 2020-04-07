import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';

@Component({
    selector: 'app-search-record-node',
    templateUrl: 'search-record-node.component.html',
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
