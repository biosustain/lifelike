import { Component, Input } from '@angular/core';

import { isNullOrUndefined } from 'util';

import { FTSReferenceRecord, GraphNode } from 'app/interfaces';
import { PUBMEDURL } from 'app/shared/constants';
import { stringToHex } from 'app/shared/utils';
import { getQueryParams } from 'app/search/utils/search';

import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { getLink } from '../utils/records';
import { GraphSearchParameters } from '../graph-search';

@Component({
  selector: 'app-search-record-relationships',
  templateUrl: './search-record-relationships.component.html',
  styleUrls: ['./search-record-relationships.component.scss'],
})
export class SearchRecordRelationshipsComponent {

  PUBMEDURL: string = PUBMEDURL;

  // TODO: We should come up with a consistent way to mark variables as private without using '_', or
  // just disable that check for tslint.
  private prvNode: FTSReferenceRecord;
  nodeURL: string;

  chemicalDisplayName = '';
  chemicalLabel = '';

  diseaseDisplayName = '';
  diseaseLabel = '';

  @Input() params: GraphSearchParameters;

  @Input()
  set node(n: FTSReferenceRecord) {
    this.prvNode = n;

    const chemical = n.chemical;
    const disease = n.disease;
    let nodeQuery = '';
    if (chemical && disease) {
      nodeQuery += chemical.id + ',' + disease.id;

      this.setChemicalDataStrings(chemical);
      this.setDiseaseDataStrings(disease);
    } else if (chemical) {
      nodeQuery += chemical.id;
      this.setChemicalDataStrings(chemical);
    } else if (disease) {
      this.setDiseaseDataStrings(disease);
      nodeQuery += disease.id;
    }
    this.nodeURL = stringToHex(nodeQuery);
  }

  get node(): FTSReferenceRecord {
    return this.prvNode;
  }

  constructor() {
  }

  setChemicalDataStrings(chemical: GraphNode) {
    this.chemicalDisplayName = isNullOrUndefined(chemical.displayName) ? '' : chemical.displayName;
    this.chemicalLabel = isNullOrUndefined(chemical.label) ? '' : chemical.label;
  }

  setDiseaseDataStrings(disease: GraphNode) {
    this.diseaseDisplayName = isNullOrUndefined(disease.displayName) ? '' : disease.displayName;
    this.diseaseLabel = isNullOrUndefined(disease.label) ? '' : disease.label;
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.node.node.displayName,
      label: this.node.node.label.toLowerCase(),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain: '',
          url: getLink(this.node),
        }],
        references: [{
          type: 'DATABASE',
          id: getLink(this.node),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  getVisualizerQueryParams(params) {
    return {
      ...getQueryParams(this.params),
      ...params,
    };
  }
}
