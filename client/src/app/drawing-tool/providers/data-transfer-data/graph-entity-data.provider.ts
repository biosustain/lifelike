import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from 'app/shared/services/data-transfer-data.service';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from '../../services/interfaces';
import { Injectable } from '@angular/core';
import {
  GenericDataProvider,
  LABEL_TOKEN,
  URI_TOKEN,
  URIData,
} from '../../../shared/providers/data-transfer-data/generic-data.provider';
import { makeid } from '../../../shared/utils/identifiers';

export const GRAPH_ENTITY_TOKEN = new DataTransferToken<GraphEntity[]>('universalGraphEntity');
export const GRAPH_NODE_TYPE = 'application/lifelike-node';

@Injectable()
export class GraphEntityDataProvider implements DataTransferDataProvider {

  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }


  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const results: DataTransferData<GraphEntity[]>[] = [];

    const data = dataTransfer.getData(GRAPH_NODE_TYPE);

    // First check if the content has a node embedded in it
    if (data !== '') {
      const node = JSON.parse(data) as UniversalGraphNode;
      results.push({
        token: GRAPH_ENTITY_TOKEN,
        data: [{
          type: GraphEntityType.Node,
          entity: node,
        }],
        confidence: 0,
      });
    } else {
      const items = this.genericDataProvider.extract(dataTransfer);
      let text: string | undefined = null;
      const uriData: URIData[] = [];

      for (const item of items) {
        if (item.token === URI_TOKEN) {
          uriData.push(...(item.data as URIData[]));
        } else if (item.token === LABEL_TOKEN) {
          text = item.data as string;
        }
      }

      if (text != null) {
        const isLink = !!text.match(/^((?:http|ftp)s?|mailto):/);

        results.push({
          token: GRAPH_ENTITY_TOKEN,
          data: [{
            type: GraphEntityType.Node,
            entity: {
              hash: makeid(),
              display_name: isLink ? 'Link' : 'Note',
              label: isLink ? 'link' : 'note',
              sub_labels: [],
              data: {
                x: 0,
                y: 0,
                detail: text,
                sources: uriData.map(item => ({
                  domain: item.title,
                  url: item.uri
                })),
              },
              style: {
                showDetail: !isLink,
              },
            },
          }],
          confidence: 0,
        });
      }
    }

    return results;
  }

}
