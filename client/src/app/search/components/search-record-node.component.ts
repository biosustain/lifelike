import { Component, Input } from '@angular/core';

import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';
import { parseURLToDomainName } from 'app/shared/utils/browser';
import * as DB from 'app/shared/url/constants';
import { AppURL } from 'app/shared/url';

import { GraphSearchParameters } from '../graph-search';
import { getLink } from '../utils/records';
import { getGraphQueryParams } from '../utils/search';

@Component({
  selector: 'app-search-record-node',
  templateUrl: 'search-record-node.component.html',
  styleUrls: ['./search-record-node.component.scss'],
})
export class SearchRecordNodeComponent {
  readonly DB = DB;
  private currentNode: FTSQueryRecord;
  nodeURL: string;
  normalizedNodeLabel: string;
  private readonly defaultDomain = 'Knowledge Graph';

  @Input() params: GraphSearchParameters;

  @Input() legend: Map<string, string>;

  @Input()
  set node(value: FTSQueryRecord) {
    this.currentNode = value;
    this.normalizedNodeLabel = value.node.label.toLowerCase();
    this.nodeURL = stringToHex(value.node.id.toString());
  }

  get node(): FTSQueryRecord {
    return this.currentNode;
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    const url = getLink(this.node);
    let domain: string;

    try {
      domain = parseURLToDomainName(url, this.defaultDomain);
    } catch {
      domain = this.defaultDomain;
    }

    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData(
      'application/***ARANGO_DB_NAME***-node',
      JSON.stringify({
        display_name: this.node.node.displayName,
        label: this.node.node.label.toLowerCase(),
        sub_labels: [],
        data: {
          hyperlinks: [
            {
              domain,
              url,
            },
          ],
          references: [
            {
              type: 'DATABASE',
              id: getLink(this.node),
            },
          ],
        },
      } as Partial<UniversalGraphNode>)
    );
  }

  getNodeDomain(url: URL): string {
    switch (url.hostname) {
      case DB.UNIPROT.url.hostname:
        return 'UniProt';
      case DB.NCBI.url.hostname:
        if (url.href.includes('mesh')) {
          return 'MeSH';
        }
        if (url.href.includes('Taxonomy')) {
          return 'NCBI Taxonomy';
        }
        if (url.href.includes('gene')) {
          return 'NCBI Gene';
        }
        return 'NCBI';
      case DB.CHEBI2.url.hostname:
        return 'ChEBI';
      case DB.GO.url.hostname:
        return 'GO';
      default:
        return 'Knowledge Graph';
    }
  }

  getVisualizerQueryParams(params) {
    return {
      ...getGraphQueryParams(this.params),
      ...params,
    };
  }
}
