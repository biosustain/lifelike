import { assign, mapValues, entries, max, isNumber, omit } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { Color } from 'd3-color';

import {
  GraphNodeSets,
  GraphGraph,
  GraphTraceNetwork,
  GraphTrace,
  GraphDetailEdge,
  GraphNode,
  GraphLink,
  GraphFile,
  GraphPredefinedSizing
} from 'app/shared/providers/graph-type/interfaces';
import { isNotEmpty } from 'app/shared/utils';

import { SankeyTraceNetwork, SankeyId, SankeyNodePosition, SankeyLinkInterface, SankeyNodeInterface } from '../interfaces';
import { indexByProperty } from '../utils';
import { SankeyView, SankeyLinksOverwrites, SankeyNodesOverwrites } from '../interfaces/view';

const listMapToDict =
  <GraphType extends object>(list: SankeyDocumentPartMixin<GraphType>[]) =>
    list.map(entity => entity.toDict());

const objectMapToDict =
  <GraphType extends object>(obj: { [key: string]: SankeyDocumentPartMixin<GraphType> }) =>
    mapValues(obj, entity => entity.toDict());

interface SankeyDocumentPartMixin<GraphType extends object> {
  toDict(): GraphType;
}

export class View implements SankeyDocumentPartMixin<SankeyView> {
  state: SankeyView['state'];
  size: SankeyView['size'];
  nodes: SankeyView['nodes'];
  links: SankeyView['links'];
  private sankeyDocument;

  constructor({state, size, nodes, links}, sankeyDocument) {
    this.sankeyDocument = sankeyDocument;
    this.state = state;
    this.size = size;
    this.nodes = nodes;
    this.links = links;
  }

  toDict() {
    return this;
  }
}

export class Trace implements SankeyDocumentPartMixin<GraphTrace> {
  nodePaths: Array<Array<number>>;
  edges: Array<number>;
  source: number;
  target: number;
  group: number;

  detailEdges?: Array<[number, number, GraphDetailEdge]>;
  color: string | Color;

  constructor({node_paths, detail_edges, ...rest}: GraphTrace) {
    assign(this, rest);
    this.nodePaths = node_paths;
    this.detailEdges = detail_edges;
  }

  toDict() {
    return {
      node_paths: this.nodePaths,
      edges: this.edges,
      source: this.source,
      target: this.target,
      group: this.group,
      detail_edges: this.detailEdges
    };
  }
}

export class TraceNetwork implements SankeyDocumentPartMixin<GraphTraceNetwork> {
  traces: Trace[];
  views$: BehaviorSubject<{ [key: string]: View }>;
  private sankeyDocument;
  sources: SankeyNode[];
  targets: SankeyNode[];
  defaultSizing: any;
  _defaultSizing: any;
  description: string;
  name: string;
  color: string | Color;
  _sources: string;
  _targets: string;

  constructor(
    {
      traces, sources, targets, default_sizing, name, description, _views
    }: SankeyTraceNetwork,
    {nodeSets, sizing}: SankeyGraph,
    sankeyDocument
  ) {
    this.sankeyDocument = sankeyDocument;
    this.traces = traces.map(trace => new Trace(trace));
    const tracesWithoutGroups = this.traces.filter(({group}) => !isNumber(group));
    if (isNotEmpty(tracesWithoutGroups)) {
      let maxVal = max(traces.map(({group}) => group ?? -1));
      if (!isFinite(maxVal)) {
        maxVal = Math.random();
      }
      tracesWithoutGroups.forEach(trace => trace.group = ++maxVal);
    }
    this._defaultSizing = default_sizing;
    this.defaultSizing = sizing[default_sizing];
    this._sources = sources;
    this._targets = targets;
    this.sources = nodeSets[sources];
    this.targets = nodeSets[targets];
    this.name = name;
    this.description = description;
    const views = mapValues(_views, view => new View(view, sankeyDocument));
    this.views$ = new BehaviorSubject(views);
    this.views$.subscribe(sankeyDocument.isDirty$);
  }

  addView(name: string, view: SankeyView) {
    this.views$.next({...this.views$.value, [name]: new View(view, this.sankeyDocument)});
  }

  deleteView(name: string) {
    this.views$.next(omit(this.views$.value, name));
  }

  toString() {
    return JSON.stringify({
      traces: this.traces,
      _views: this.views$.value,
      sources: this.sources,
      targets: this.targets,
    });
  }

  toDict() {
    return {
      traces: listMapToDict(this.traces),
      _views: objectMapToDict(this.views$.value),
      sources: this._sources,
      targets: this._targets,
      description: this.description,
      name: this.name,
      default_sizing: this._defaultSizing,
    };
  }
}

class NodeSets implements SankeyDocumentPartMixin<GraphNodeSets> {
  notMappedNodeSets: GraphNodeSets;

  constructor(nodeSets: GraphNodeSets, sankeyDocument) {
    this.notMappedNodeSets = nodeSets;
    entries(nodeSets).forEach(([key, value]) => {
      this[key] = value.map(id => sankeyDocument.nodeById.get(id));
    });
  }

  toDict() {
    return this.notMappedNodeSets;
  }
}

class SankeyGraph implements SankeyDocumentPartMixin<GraphGraph> {
  traceNetworks: TraceNetwork[];
  private readonly sankeyDocument;
  nodeSets: NodeSets;
  description: string;
  name?: string;
  sizing?: GraphPredefinedSizing;
  log?: string | Array<string>;

  constructor({trace_networks, sizing = {}, node_sets}, sankeyDocument) {
    this.sankeyDocument = sankeyDocument;
    this.sizing = sizing;
    this.nodeSets = new NodeSets(node_sets, sankeyDocument);
    this.traceNetworks = trace_networks.map(traceNetwork => new TraceNetwork(traceNetwork, this, sankeyDocument));
  }

  toDict() {
    return {
      trace_networks: listMapToDict(this.traceNetworks),
      node_sets: this.nodeSets.toDict(),
      sizing: this.sizing,
      log: this.log,
      name: this.name,
      description: this.description
    };
  }
}

export class SankeyNode<Link extends (SankeyLink | SankeyTraceLink) = (SankeyLink | SankeyTraceLink)>
  implements SankeyDocumentPartMixin<GraphNode>, SankeyNodePosition, SankeyNodeInterface {
  id: number;
  depth: number;
  index: number;
  layer: number;
  sourceLinks: Link[];
  targetLinks: Link[];
  y0: number;
  y1: number;
  reversedDepth: number;
  height: number;
  x0: number;
  x1: number;
  label?: string;
  color: string | Color;
  description?: string;
  value?: number;
  order: number;

  constructor(node, id) {
    assign(this, node);
    this.id = id;
  }

  toDict() {
    return {
      id: this.id
    };
  }

  get viewProperties() {
    return {
      value: this.value,
      layer: this.layer,
      depth: this.depth,
      height: this.height,
      x0: this.x0,
      x1: this.x1,
      y0: this.y0,
      y1: this.y1,
      order: this.order,
    };
  }
}

export class SankeyLink implements SankeyDocumentPartMixin<GraphLink>, SankeyLinkInterface {
  id: any;
  source: any;
  target: any;
  value: number;
  multipleValues: [number, number];
  traces: Trace[];
  circular: boolean;
  y0: number;
  y1: number;
  width: number;
  description: string;
  label: string;
  color: string | Color;
  graphRelativePosition?: 'left' | 'right' | 'multiple';
  visited?: string | number;
  order: number;
  readonly adjacentDivider = 1;

  constructor({source, target, ...rest}, id, sankeyDocument) {
    assign(this, rest);
    this.id = id;
    this.source = sankeyDocument.nodeById.get(source);
    this.target = sankeyDocument.nodeById.get(target);
  }

  toDict() {
    return {
      source: this.source.id,
      target: this.target.id,
      description: this.description,
      label: this.label
    };
  }

  get viewProperties() {
    return {
      value: this.value,
      multipleValues: this.multipleValues,
      y0: this.y0,
      y1: this.y1,
      circular: this.circular,
      width: this.width,
      order: this.order,
      adjacentDivider: this.adjacentDivider,
      id: this.id
    };
  }
}

export class SankeyTraceLink implements SankeyLinkInterface {
  id: string;
  originLink: SankeyLink;
  trace: Trace;
  color: string | Color;
  order: number;
  originLinkId: number;
  y0: number;
  y1: number;
  width: number;
  adjacentDivider: number;
  multipleValues: [number, number];
  value: number;
  circular: boolean;

  constructor(originLink, trace, traceIdx) {
    this.originLink = originLink;
    this.trace = trace;
    this.id = `${originLink.id}_${trace.group}_${traceIdx}`;
    this.color = trace.color;
    this.order = -trace.group;
    this.originLinkId = originLink.id;
  }

  get source() {
    return this.originLink.source;
  }

  get target() {
    return this.originLink.target;
  }

  get description() {
    return this.originLink.description;
  }

  get label() {
    return this.originLink.label;
  }

  get viewProperties() {
    return {
      value: this.value,
      multipleValues: this.multipleValues,
      y0: this.y0,
      y1: this.y1,
      circular: this.circular,
      width: this.width,
      order: this.order,
      adjacentDivider: this.adjacentDivider,
      id: this.id
    };
  }
}

export class SankeyDocument implements SankeyDocumentPartMixin<GraphFile> {
  nodes: SankeyNode[];
  links: SankeyLink[];
  graph: SankeyGraph;
  nodeById: Map<SankeyId, SankeyNode>;
  isDirty$: BehaviorSubject<boolean>;
  directed: boolean;
  multigraph: boolean;

  constructor({nodes, links, graph, ...rest}: GraphFile) {
    assign(this, rest);
    this.isDirty$ = new BehaviorSubject(false);

    this.nodes = nodes.map(node => new SankeyNode(node, node.id));
    this.nodeById = indexByProperty(this.nodes, 'id');
    this.links = links.map((link, index) => new SankeyLink(link, index, this));
    this.graph = new SankeyGraph(graph, this);
  }

  toDict() {
    return {
      nodes: listMapToDict(this.nodes),
      links: listMapToDict(this.links),
      graph: this.graph.toDict(),
      directed: this.directed,
      multigraph: this.multigraph
    };
  }
}
