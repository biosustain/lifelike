import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from '../../../shared/services/data-transfer-data.service';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from '../../services/interfaces';

export const GRAPH_ENTITY_TOKEN = new DataTransferToken<GraphEntity[]>('universalGraphEntity');
export const GRAPH_NODE_TYPE = 'application/lifelike-node';

export class GraphEntityDataProvider implements DataTransferDataProvider {

  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const results: DataTransferData<GraphEntity[]>[] = [];

    const data = dataTransfer.getData(GRAPH_NODE_TYPE);
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
    }

    return results;
  }

}
