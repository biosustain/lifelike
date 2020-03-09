import { Component, Input } from '@angular/core';
import { FTSReferenceRecord } from 'app/interfaces';
import { PubMedURL } from 'app/shared/constants';
import { stringToHex } from 'app/shared/utils';

@Component({
    selector: 'app-search-record-relationships',
    templateUrl: './search-record-relationships.component.html',
    styleUrls: ['./search-record.component.scss']
})
export class SearchRecordRelationshipsComponent {

    PUBMEDURL: string = PubMedURL;

    private _node: FTSReferenceRecord;
    nodeURL: string;

    @Input()
    set node(n: FTSReferenceRecord) {
        this._node = n;

        const chemical = n.chemical;
        const disease = n.disease;
        let nodeQuery = '';
        if (chemical && disease) {
            nodeQuery += chemical.id + ',' + disease.id;
        } else if (chemical) {
            nodeQuery += chemical.id;
        } else if (disease) {
            nodeQuery += disease.id;
        }
        this.nodeURL = stringToHex(nodeQuery);
    }

    get node(): FTSReferenceRecord {
        return this._node;
    }

    constructor() {}
}
