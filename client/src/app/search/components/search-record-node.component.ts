import { Component, Input } from '@angular/core';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { getLink } from '../utils/records';
import { getQueryParams } from '../utils/search';
import { GraphSearchParameters } from '../graph-search';

@Component({
  selector: 'app-search-record-node',
  templateUrl: 'search-record-node.component.html',
  styleUrls: ['./search-record-node.component.scss'],
})
export class SearchRecordNodeComponent {

  nodeURL: string;
  normalizedNodeLabel: string;
  @Input() params: GraphSearchParameters;
  @Input() legend: Map<string, string>;
  private currentNode: FTSQueryRecord;

  get node(): FTSQueryRecord {
    return this.currentNode;
  }

  @Input()
  set node(value: FTSQueryRecord) {
    this.currentNode = value;
    this.normalizedNodeLabel = value.node.label.toLowerCase();
    this.nodeURL = stringToHex(value.node.id.toString());
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: this.node.node.displayName,
      label: this.node.node.label.toLowerCase(),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain: 'Visualizer',
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
