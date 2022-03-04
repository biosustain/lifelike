import { Component, ViewEncapsulation, isDevMode, } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';

import { map, shareReplay, tap } from 'rxjs/operators';
import { isObject, isBoolean, isArray, has, isNil, isString, isNumber, isUndefined, first } from 'lodash-es';

import { SankeyId, SankeyNode } from 'app/shared-sankey/interfaces';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';


enum OverviewEntityType {
  nodeId,
  linkId,
  nodeSetId
}

interface TreeNode {
  label: string;
  value?: string | number | boolean;
  accessor?: () => Array<TreeNode>;
  type?: OverviewEntityType;
  ref?: string | number;
}

const property = (label, accessor) => ({
  label,
  accessor
});

const indexLabel = i => `[ ${i} ]`;

const parseArray = (arr, accessor) => arr?.map((v, i) =>
  property(indexLabel(i), () => accessor(v))
);

const mapPrimitiveValue = value => {
  if (isBoolean(value)) {
    return value ? 'true' : 'false';
  }
  if (isString(value) || isNumber(value)) {
    return value;
  }
  if (value !== value) {
    return 'NaN';
  }
  if (isUndefined(value)) {
    return 'undefined';
  }
};

const mapSomething = (label, something) => {
  const value = mapPrimitiveValue(something);
  if (!isNil(value)) {
    return {label, value};
  }
  if (isArray(something)) {
    return {
      label,
      accessor: () => something.map((v, i) => mapSomething(indexLabel(i), v))
    };
  }
  if (isObject(something)) {
    return {
      label,
      accessor: () => mapObj(something)
    };
  }
  return {
    label,
    value: String(something)
  };
};

const mapObj = obj =>
  Object.entries(obj)
    .filter(isDevMode() ? () => true : ([label]) => first(label) !== '_')
    .map(([label, value]) =>
      mapSomething(label, value)
    );

const parseNodeId = nodeId => ({
  label: nodeId,
  ref: nodeId,
  type: OverviewEntityType.nodeId,
});

const parseNodeIds = nodeIds => nodeIds.map(parseNodeId);

const parseLinkId = linkId => ({
  label: linkId,
  ref: linkId,
  type: OverviewEntityType.linkId,
});

const parseLinkIds = nodeIds => nodeIds.map(parseLinkId);

const parseNodePaths = nodePaths => parseArray(nodePaths, parseNodeIds);

const parseDetailEdges = detailEdges => parseArray(detailEdges, parseLinkIds);

const parseNodeSetId = (label, nodeSetId) => ({
  label,
  value: nodeSetId,
  ref: nodeSetId,
  type: OverviewEntityType.nodeSetId,
});

const parseTrace = ({node_paths, edges, source, target, detail_edges, ...rest}) => ([
  property('node_paths', () => parseNodePaths(node_paths)),
  property('edges', () => parseLinkIds(edges)),
  {...parseNodeId(source), label: 'source'},
  {...parseNodeId(target), label: 'target'},
  property('detail_edges', () => parseDetailEdges(detail_edges)),
  ...mapObj(rest)
]);

const parseTraceNetwork = ({
                             sources, targets, traces, ...rest
                           }) => ([
  property('traces', () => parseArray(traces, parseTrace)),
  parseNodeSetId('sources', sources),
  parseNodeSetId('targets', targets),
  ...mapObj(rest)
]);

const parseNodeSets = nodeSets => Object.entries(nodeSets).map(([label, value]) =>
  property(label, () => parseNodeIds(value))
);

const parseNode = mapObj;

const parseLink = ({
                     source, target, ...rest
                   }) => ([
  {...parseNodeId(source), label: 'source'},
  {...parseNodeId(target), label: 'target'},
  ...mapObj(rest)
]);

const parseGraph = ({node_sets, trace_networks, ...rest}) => ([
  property('trace_networks', () => parseArray(trace_networks, parseTraceNetwork)),
  property('node_sets', () => parseNodeSets(node_sets)),
  ...mapObj(rest)
]);

const parseGraphFile = ({graph, nodes, links, ...rest}) => ([
  property('graph', () => parseGraph(graph)),
  property('nodes', () => parseArray(nodes, parseNode)),
  property('links', () => parseArray(links, parseLink)),
  ...mapObj(rest)
]);

@Component({
  selector: 'app-sankey-structure-overview',
  templateUrl: './structure-overview.component.html',
  styleUrls: ['./structure-overview.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StructureOverviewComponent {
  constructor(private common: SankeyControllerService) {
  }

  dataSource$ = this.common.allData.pipe(
    map(parseGraphFile),
    shareReplay(1)
  );

  getNodeById$ = this.common.allData.pipe(
    map(({nodes}) => new Map<SankeyId, SankeyNode>(nodes.map(node => [node.id, node]))),
    shareReplay(1)
  );

  links$ = this.common.allData.pipe(
    map(({links}) => links),
    shareReplay(1)
  );

  nodeSets$ = this.common.allData.pipe(
    map(({graph: {node_sets}}) => node_sets),
    shareReplay(1)
  );

  treeControl = new NestedTreeControl<TreeNode>(this.getChildren.bind(this));

  getChildren(treeNode: TreeNode) {
    switch (treeNode?.type) {
      case OverviewEntityType.nodeId:
        return this.getNodeById$.pipe(
          map(nodeById => parseNode(nodeById.get(treeNode.ref)))
        );
      case OverviewEntityType.linkId:
        return this.links$.pipe(
          map(links => parseLink(links[treeNode.ref]))
        );
      case OverviewEntityType.nodeSetId:
        return this.nodeSets$.pipe(
          map(nodeSets => parseNodeIds(nodeSets[treeNode.ref]))
        );
      default:
        return treeNode?.accessor?.();
    }
    throw new Error('Not implemented');
  }

  hasChildren(index: number, node: TreeNode): boolean {
    return has(node, 'accessor') || has(node, 'type');
  }

  getNodeLabel({label, value}: TreeNode): string {
    return isNil(value) ? label : `${label} : ${value}`;
  }

  getNodeIcon(treeNode: TreeNode): string {
    return 'fas fa-' + (
      has(treeNode, 'ref') ?
        (this.treeControl.isExpanded(treeNode) ? 'unlink' : 'link') :
        (this.treeControl.isExpanded(treeNode) ? 'angle-down' : 'angle-right')
    );
  }
}
