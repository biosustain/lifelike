import { Component, Input } from '@angular/core';
import { FTSQueryRecord, SearchParameters } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { getLink } from '../utils/records';
import { getQueryParams } from '../utils/search';

@Component({
  selector: 'app-search-record-node',
  templateUrl: 'search-record-node.component.html',
  styleUrls: ['./search-record-node.component.scss'],
})
export class SearchRecordNodeComponent {

  private currentNode: FTSQueryRecord;
  nodeURL: string;

  @Input() params: SearchParameters;

  @Input() legend: Map<string, string>;

  @Input()
  set node(value: FTSQueryRecord) {
    this.currentNode = value;
    this.nodeURL = stringToHex(value.node.id.toString());
  }

  get node(): FTSQueryRecord {
    return this.currentNode;
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.node.node.displayName,
      label: this.node.node.label.toLowerCase(),
      sub_labels: [],
      data: {
        hyperlink: getLink(this.node),
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
