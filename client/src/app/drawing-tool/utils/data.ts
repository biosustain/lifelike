import { uuidv4 } from 'app/shared/utils/identifiers';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';

import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphNode,
} from '../services/interfaces';

export function extractGraphEntityActions(items: DataTransferData<any>[], origin: { x: number, y: number }) {
  let entities: GraphEntity[] = [];
  const actions: GraphAction[] = [];

  for (const item of items) {
    if (item.token === GRAPH_ENTITY_TOKEN) {
      entities = item.data as GraphEntity[];
    }
  }

  entities = normalizeGraphEntities(entities, origin);

  // Create nodes
  for (const entity of entities) {
    if (entity.type === GraphEntityType.Node) {
      const node = entity.entity as UniversalGraphNode;
      actions.push(new NodeCreation(
        `Create ${node.display_name} node`, node, true,
      ));
    } else if (entity.type === GraphEntityType.Edge) {
      const edge = entity.entity as UniversalGraphEdge;
      actions.push(new EdgeCreation(
        `Create edge`, edge, true,
      ));
    }
  }

  return actions;
}

export function normalizeGraphEntities(entities: GraphEntity[], origin: { x: number, y: number }): GraphEntity[] {
  const newEntities: GraphEntity[] = [];
  const nodeHashMap = new Map<string, string>();

  // Create nodes
  for (const entity of entities) {
    if (entity.type === GraphEntityType.Node) {
      const node = entity.entity as UniversalGraphNode;
      const newId = uuidv4();
      nodeHashMap.set(node.hash, newId);
      newEntities.push({
        type: GraphEntityType.Node,
        entity: {
          hash: newId,
          ...node,
          data: {
            ...node.data,
            x: origin.x + ((node.data && node.data.x) || 0),
            y: origin.y + ((node.data && node.data.y) || 0),
          },
        },
      });
    }
  }

  // Create edges
  for (const entity of entities) {
    if (entity.type === GraphEntityType.Edge) {
      const edge = entity.entity as UniversalGraphEdge;
      const newFrom = nodeHashMap.get(edge.from);
      const newTo = nodeHashMap.get(edge.to);
      if (newFrom != null && newTo != null) {
        newEntities.push({
          type: GraphEntityType.Edge,
          entity: {
            ...edge,
            from: newFrom,
            to: newTo,
          },
        });
      }
    }
  }

  return newEntities;
}
