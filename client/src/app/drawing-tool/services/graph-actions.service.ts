import { Injectable } from '@angular/core';

import { iif, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import { IMAGE_DEFAULT_SIZE, IMAGE_LABEL } from 'app/shared/constants';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { Point } from 'app/graph-viewer/utils/canvas/shared';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';

import { MapImageProviderService } from './map-image-provider.service';
import { IMAGE_TOKEN, ImageTransferData } from '../providers/image-entity-data.provider';
import { GraphEntity, GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from './interfaces';
import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';

@Injectable()
export class GraphActionsService {

  constructor(readonly mapImageProviderService: MapImageProviderService,
              readonly filesystemService: FilesystemService) { }

  fromDataTransferItems(items: DataTransferData<any>[], hoverPosition: Point): Promise<GraphAction[]> {

    const actions = this.extractGraphEntityActions(items, hoverPosition);
    return this.extractImageNodeActions(items, hoverPosition, actions);
  }

  async extractImageNodeActions(items: DataTransferData<any>[], {x, y}: Point, actions: GraphAction[]): Promise<GraphAction[]> {
    const imageItems = items.filter(item => item.token === IMAGE_TOKEN);

    let node;
    const imageId = makeid();
    await of(...imageItems).pipe(
      switchMap(item => {
        const data = item.data as ImageTransferData;
        node = data.node;
        // If the image was dropped, we have the blob inside DataTransfer. If the image was dragged from within the LL,
        // We need to load it's content.
        return iif(
          () => Boolean(data.blob),
          of(data.blob),
          this.filesystemService.getContent(data.hash),
        );
      }),
      switchMap(blob => {
          return this.mapImageProviderService.doInitialProcessing(imageId, new File([blob], imageId));
      }),
      take(imageItems.length),
      map(dimensions => {
      // Scale smaller side up to 300 px
      const ratio = IMAGE_DEFAULT_SIZE / Math.min(dimensions.width, dimensions.height);
      return (new NodeCreation(`Insert image`, {
        ...node,
        hash: uuidv4(),
        image_id: imageId,
        label: IMAGE_LABEL,
        data: {
          ...node.data,
          x,
          y,
          width: dimensions.width * ratio,
          height: dimensions.height * ratio,
        },
      }, true));
    }),
    tap(action => actions.push(action)),
    ).toPromise();

    return actions;
  }

  extractGraphEntityActions(items: DataTransferData<any>[], origin: { x: number, y: number }): GraphAction[] {
  let entities: GraphEntity[] = [];
  const actions: GraphAction[] = [];

  for (const item of items) {
    if (item.token === GRAPH_ENTITY_TOKEN) {
      entities = item.data as GraphEntity[];
    }
  }

  entities = this.normalizeGraphEntities(entities, origin);

  // Create nodes and edges
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

 normalizeGraphEntities(entities: GraphEntity[], origin: { x: number, y: number }): GraphEntity[] {
  const newEntities: GraphEntity[] = [];
  const nodeHashMap = new Map<string, string>();
  const nodes = [];
  const edges = [];
  entities.forEach((entity) => entity.type === GraphEntityType.Node ? nodes.push(entity) : edges.push(entity));

  // Create nodes and edges
  for (const entity of nodes) {
    const node = entity.entity as UniversalGraphNode;
    // Creating a new hash like this when we're assuming that a hash already exists seems kind of fishy to me. Leaving this here
    // because I don't want to break anything, but it's worth pointing out.
    const newId = node.hash || uuidv4();
    nodeHashMap.set(node.hash, newId);
    newEntities.push({
      type: GraphEntityType.Node,
      entity: {
        ...node,
        hash: newId,
        data: {
          ...node.data,
          x: origin.x + ((node.data && node.data.x) || 0),
          y: origin.y + ((node.data && node.data.y) || 0),
        },
      },
    });
  }

  for (const entity of edges) {
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

  return newEntities;
}

}
