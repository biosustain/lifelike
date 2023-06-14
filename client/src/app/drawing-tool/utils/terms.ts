import {
  filter as _filter,
  flatMap as _flatMap,
  flow as _flow,
  identity as _identity,
  map as _map,
  uniq as _uniq,
  compact as _compact,
} from 'lodash/fp';

import { GraphView } from 'app/graph-viewer/renderers/graph-view';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphGroup,
  UniversalGraphNode,
} from '../services/interfaces';

export const getTermsFromNode = (node: UniversalGraphNode): string | null => node?.display_name;

export function getTermsFromEdge(this: GraphView<any>, edge: UniversalGraphEdge): string {
  return _compact([
    getTermsFromNode(this.getNodelikeByHash(edge.from)),
    edge.label,
    getTermsFromNode(this.getNodelikeByHash(edge.to)),
  ]).join(' ');
}

export const getTermsFromGroup = (
  filter: { [k in GraphEntityType]?: (e: UniversalGraphEntity) => boolean } = {}
) => {
  const getTermsFromFilteredNodes = _flow(
    _filter(filter[GraphEntityType.Node] ?? Boolean),
    _map(getTermsFromNode),
    _compact
  );
  return (group: UniversalGraphGroup): string[] => getTermsFromFilteredNodes(group.members);
};

export const getTermsFromGraphEntity = (filter: {
  [k in GraphEntityType]?: (e: UniversalGraphEntity) => boolean;
}) =>
  function (this: GraphView<any>, { entity, type }: GraphEntity): string | string[] | null {
    if (!(filter[type] ?? Boolean)(entity)) {
      return [];
    } else if (type === GraphEntityType.Edge) {
      return getTermsFromEdge.call(this, entity as UniversalGraphEdge);
    } else if (type === GraphEntityType.Node) {
      return getTermsFromNode.call(this, entity as UniversalGraphNode);
    } else if (type === GraphEntityType.Group) {
      return getTermsFromGroup(filter).call(this, entity as UniversalGraphGroup);
    } else {
      return [];
    }
  };

const extractEdgeNodeHashes = _flow(
  _filter(({ type }: GraphEntity) => type === GraphEntityType.Edge),
  _map(({ entity }) => entity as UniversalGraphEdge),
  _flatMap(({ from, to }) => [from, to]),
  _uniq
);

export function getTermsFromGraphEntityArray(entities: GraphEntity[]): string[] {
  const edgeNodeHashes = extractEdgeNodeHashes(entities);
  return _flow(
    _map(
      getTermsFromGraphEntity({
        // Nodes that are included as part of the edge terms should not be included again
        [GraphEntityType.Node]: (node: UniversalGraphNode) => !edgeNodeHashes.includes(node.hash),
      }).bind(this)
    ),
    _flatMap(_identity),
    _compact
  )(entities);
}
