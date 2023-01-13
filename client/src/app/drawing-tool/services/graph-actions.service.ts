import { Injectable } from '@angular/core';

import { combineLatest, iif, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { merge, isNil, omitBy, flatMap, unary, isEmpty } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils/identifiers';
import { IMAGE_DEFAULT_SIZE, IMAGE_LABEL } from 'app/shared/constants';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { Point } from 'app/graph-viewer/utils/canvas/shared';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';
import { GroupCreation } from 'app/graph-viewer/actions/groups';
import { isInternalUri } from 'app/shared/url/internal';
import { AppURL } from 'app/shared/url';
import { createImageNode, createNode } from 'app/graph-viewer/utils/objects';

import { MapImageProviderService } from './map-image-provider.service';
import { IMAGE_TOKEN, ImageTransferData } from '../providers/image-entity-data.provider';
import {
  GraphEntity,
  GraphEntityType,
  UniversalEntityData,
  UniversalGraphEdge,
  UniversalGraphGroup,
  UniversalGraphNode,
} from './interfaces';
import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';

@Injectable()
export class GraphActionsService {
  constructor(
    readonly mapImageProviderService: MapImageProviderService,
    readonly filesystemService: FilesystemService
  ) {}

  fromDataTransferItems(
    items: DataTransferData<any>[],
    hoverPosition: Point
  ): Promise<GraphAction[]> {
    const actions = this.extractGraphEntityActions(items, hoverPosition);
    return this.extractImageNodeActions(items, hoverPosition).then((imageNodeActions) =>
      actions.concat(imageNodeActions)
    );
  }

  extractImageNodeActions(items: DataTransferData<any>[], { x, y }: Point): Promise<GraphAction[]> {
    const imageItems = items.filter((item) => item.token === IMAGE_TOKEN);
    if (isEmpty(imageItems)) {
      return Promise.resolve([]);
    }
    return combineLatest(
      ...imageItems.map(({ data }: { data: ImageTransferData }) => {
        const imageNode = createImageNode(data.node);
        const { image_id } = imageNode;
        // If the image was dropped, we have the blob inside DataTransfer. If the image was dragged from within the LL,
        // We need to load it's content.
        return iif(
          () => Boolean(data.blob),
          of(data.blob),
          this.filesystemService.getContent(data.hash)
        ).pipe(
          switchMap((blob) =>
            this.mapImageProviderService.doInitialProcessing(image_id, new File([blob], image_id))
          ),
          map((dimensions) => {
            // Scale smaller side up to 300 px
            const ratio = IMAGE_DEFAULT_SIZE / Math.min(dimensions.width, dimensions.height);
            return new NodeCreation(
              `Insert image`,
              merge(imageNode, {
                data: {
                  x,
                  y,
                  width: dimensions.width * ratio,
                  height: dimensions.height * ratio,
                },
              }),
              true
            );
          })
        );
      })
    ).toPromise();
  }

  mapInternalLinks<E extends { data?: UniversalEntityData }>(entity: E): E {
    const mapInternalToRelativeLink = ({ url, ...rest }) => {
      const appUrl = AppURL.from(url);
      return {
        ...rest,
          url: isInternalUri(appUrl) ? appUrl.relativehref : url
      };
    };
    return merge(entity, {
      data: omitBy(
        {
          sources: entity.data?.sources?.map(mapInternalToRelativeLink),
          hyperlinks: entity.data?.hyperlinks?.map(mapInternalToRelativeLink),
        },
        isNil
      ),
    });
  }

  extractGraphEntityActions(
    items: DataTransferData<any>[],
    origin: { x: number; y: number }
  ): GraphAction[] {
    let entities: GraphEntity[] = [];
    const actions: GraphAction[] = [];

    for (const item of items) {
      if (item.token === GRAPH_ENTITY_TOKEN) {
        entities = item.data as GraphEntity[];
      }
    }

    entities = this.normalizeGraphEntities(entities, origin);
    const isSingularEntity = entities.length === 1;

    // Create nodes and edges
    for (const { type, entity } of entities) {
      if (type === GraphEntityType.Node) {
        const node = entity as UniversalGraphNode;
        actions.push(
          new NodeCreation(`Create ${node.display_name} node`, node, true, isSingularEntity)
        );
      } else if (type === GraphEntityType.Edge) {
        const edge = entity as UniversalGraphEdge;
        actions.push(new EdgeCreation(`Create edge`, edge, true, isSingularEntity));
      } else if (type === GraphEntityType.Group) {
        const group = this.mapInternalLinks(entity as UniversalGraphGroup);
        actions.push(new GroupCreation(`Create group`, group, true, isSingularEntity));
      }
    }

    return actions;
  }

  normalizeGraphEntities(entities: GraphEntity[], origin: { x: number; y: number }): GraphEntity[] {
    const newEntities: GraphEntity[] = [];
    const nodeHashMap = new Map<string, string>();
    const nodes = [];
    const edges = [];
    entities.forEach((entity) =>
      entity.type === GraphEntityType.Node ? nodes.push(entity) : edges.push(entity)
    );

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
