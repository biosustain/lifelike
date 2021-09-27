import { Component, Input } from '@angular/core';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { parseURLToDomainName } from '../utils/browser';

@Component({
  selector: 'app-node-relationship',
  templateUrl: 'node-relationship-display.component.html',
  styleUrls: ['./node-relationship-display.component.scss'],
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

  constructor() {
  }

  getDTCompatibleLabel(label: string) {
    const match = label.match(/^Literature([a-zA-Z]+)$/);
    if (match) {
      return match[1].toLowerCase();
    }
    return label.toLowerCase();
  }

  nodeDragStart(event: DragEvent, displayName: string, label: string, databaseUrl: string) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', displayName);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: displayName,
      label: this.getDTCompatibleLabel(label),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain: parseURLToDomainName(databaseUrl),
          url: databaseUrl,
        }],
        references: [{
          type: 'DATABASE',
          id: databaseUrl,
        }],
      },
    } as Partial<UniversalGraphNode>));
  }
}
