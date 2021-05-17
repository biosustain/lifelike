import { Component, Input } from '@angular/core';

import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { FTSQueryRecord } from 'app/interfaces';
import { stringToHex } from 'app/shared/utils';

import { GraphSearchParameters } from '../graph-search';
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
  normalizedNodeLabel: string;

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
    let url: URL | string;
    let domain = '';
    try {
      url = new URL(getLink(this.node));
      domain = this.getNodeDomain(url.hostname);
    } catch {
      // Expect a TypeError here if the url was invalid
      url = getLink(this.node);
      domain = 'Knowledge Graph';
    }

    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.node.node.displayName,
      label: this.node.node.label.toLowerCase(),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain,
          url: url.toString()
        }],
        references: [{
          type: 'DATABASE',
          id: getLink(this.node),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  getNodeDomain(hostname: string): string {
    // Examples:
    // UniProt -- https://www.uniprot.org/uniprot/Q59RR0
    // NCBI -- https://www.ncbi.nlm.nih.gov/gene/850822
    // MeSH -- https://www.ncbi.nlm.nih.gov/mesh/?term=C413524
    // ChEBI -- https://www.ebi.ac.uk/chebi/searchId.do?chebiId=147289
    // GO -- http://amigo.geneontology.org/amigo/term/GO:0097649

    switch (hostname) {
      case 'www.uniprot.org':
        return 'UniProt';
      case 'www.ncbi.nlm.nih.gov':
        return 'NCBI';
      case 'www.ebi.ac.uk':
        return 'ChEBI';
      case 'amigo.geneontology.org':
        return 'GO';
      default:
        return 'Knowledge Graph';
    }
  }

  getVisualizerQueryParams(params) {
    return {
      ...getQueryParams(this.params),
      ...params,
    };
  }
}
