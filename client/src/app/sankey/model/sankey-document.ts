import { assign, mapValues, entries, max, isNumber, omit, zip, flatMap } from 'lodash-es';
import { BehaviorSubject, Observable } from 'rxjs';
import { Color } from 'd3-color';
import { switchMap } from 'rxjs/internal/operators/switchMap';
import { shareReplay, map, first } from 'rxjs/operators';

import Graph from 'app/shared/providers/graph-type/interfaces';
import { isNotEmpty } from 'app/shared/utils';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

import {
  SankeyTraceNetwork, SankeyId, SankeyNodePosition, SankeyLinkInterface,
  SankeyNodeInterface, DisplayProperty, SankeyState
} from '../interfaces';
import { indexByProperty } from '../utils';
import { SankeyView } from '../interfaces/view';
import { ErrorMessages } from '../constants/error';

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
    return {
      state: this.state,
      size: this.size,
      nodes: this.nodes,
      links: this.links
    };
  }
}

export class Trace implements SankeyDocumentPartMixin<Graph.Trace> {
  id: number;
  nodePaths: Array<Array<number>>;
  edges: Array<number>;
  source: number;
  target: number;
  group: number;
  displayProperties?: DisplayProperty[];

  detailEdges?: Array<[number, number, Graph.DetailEdge]>;
  color: string | Color;

  constructor({node_paths, detail_edges, ...rest}: Graph.Trace, id) {
    assign(this, rest);
    this.id = id;
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

  containsNode(nodeId) {
    return flatMap(this.nodePaths).some(id => id === nodeId);
  }

  containsLink(linkId) {
    return this.edges.some(id => id === linkId);
  }
}

export class TraceNetwork implements SankeyDocumentPartMixin<Graph.TraceNetwork> {
  traces: Trace[];
  views$: BehaviorSubject<Record<string, View>>;
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
  defaults: Record<keyof SankeyState, string>;

  get views() {
    return this.views$.value;
  }

  constructor(
    {
      traces, sources, targets, default_sizing, defaults, name, description, _views
    }: SankeyTraceNetwork,
    {nodeSets, sizing}: SankeyGraph,
    sankeyDocument
  ) {
    this.sankeyDocument = sankeyDocument;
    this.defaults = defaults;
    this.traces = traces.map((trace, index) => new Trace(trace, index));
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

  toJSON() {
    return JSON.stringify(this.toDict());
  }
}

class NodeSets implements SankeyDocumentPartMixin<Graph.NodeSets> {
  notMappedNodeSets: Graph.NodeSets;

  constructor(nodeSets: Graph.NodeSets, sankeyDocument) {
    this.notMappedNodeSets = nodeSets;
    entries(nodeSets).forEach(([key, value]) => {
      this[key] = value.map(id => sankeyDocument.nodeById.get(id));
    });
  }

  toDict() {
    return this.notMappedNodeSets;
  }
}

class SankeyGraph implements SankeyDocumentPartMixin<Graph.Graph> {
  traceNetworks: TraceNetwork[];
  private readonly sankeyDocument;
  nodeSets: NodeSets;
  description: string;
  name?: string;
  sizing?: Graph.PredefinedSizing;
  log?: string | Array<string>;

  constructor({trace_networks, sizing = {}, node_sets}, sankeyDocument) {
    this.sankeyDocument = sankeyDocument;
    this.sizing = sizing;
    this.nodeSets = new NodeSets(node_sets, sankeyDocument);

    if (!trace_networks.length) {
      throw Error(ErrorMessages.missingNetworkTraces);
    }
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
  implements SankeyDocumentPartMixin<Graph.Node>, SankeyNodePosition, SankeyNodeInterface {
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
  value: number;
  order: number;
  displayProperties?: DisplayProperty[];

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

export class SankeyLink implements SankeyDocumentPartMixin<Graph.Link>, SankeyLinkInterface {
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
  displayProperties?: DisplayProperty[];

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

  get(key: string) {
    return this[key];
  }

  belongsToTrace(id) {
    return this.traces.some(trace => trace.id === id);
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

  get displayProperties() {
    return this.originLink.displayProperties;
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

  get(key) {
    return this[key] ?? this.originLink.get(key);
  }

  belongsToTrace(id) {
    return this.trace.id === id;
  }
}

export class SankeyDocument implements SankeyDocumentPartMixin<Graph.File> {
  nodes: SankeyNode[];
  links: SankeyLink[];
  graph: SankeyGraph;
  nodeById: Map<SankeyId, SankeyNode>;
  isDirty$: BehaviorSubject<boolean>;
  directed: boolean;
  multigraph: boolean;

  constructor({nodes, links, graph, ...rest}: Graph.File) {
    if (!nodes.length) {
      throw Error(ErrorMessages.missingNodes);
    }
    if (!links.length) {
      throw Error(ErrorMessages.missingLinks);
    }

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

export class SankeyFile {

  constructor(
    filesystemService: FilesystemService,
    hashId: string
  ) {
    this.hashId = hashId;
    this.filesystemService = filesystemService;
    this.reload();
  }


  private readonly hashId;
  private readonly filesystemService: FilesystemService;

  metaLoadTask = new BackgroundTask<string, FilesystemObject>(
    hash => this.filesystemService.get(hash)
  );

  contentLoadTask = new BackgroundTask<string, Graph.File>(
    hash => this.filesystemService.getContent(hash).pipe(
      mapBlobToBuffer(),
      mapBufferToJson()
    )
  );

  metadata$ = this.metaLoadTask.results$.pipe(
    map(({result}) => result),
    shareReplay<FilesystemObject>({bufferSize: 1, refCount: true})
  );

  content$ = this.contentLoadTask.results$.pipe(
    map(({result}) => result),
    shareReplay<Graph.File>({bufferSize: 1, refCount: true})
  );

  document$ = this.content$.pipe(
    map(raw => new SankeyDocument(raw)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /**
   * Temporary safty net SankeyDocument is under development
   * SankeyDocument.toDict() should give stringable representation of file
   * and SankeyDocument.toString() should encode it as string.
   * Ultimatly for given FileContent:
   * `new SankeyDocument(FileContent).toString() = FileContent`
   * yet current implementation cannot guarantee that just yet.
   */
  contentWithOnlyViewsUpdated$ = this.content$.pipe(
    switchMap(({graph: {trace_networks, ...fcGraph}, ...fc}) =>
      this.document$.pipe(
        map(({graph: {traceNetworks}}) => ({
          graph: {
            ...fcGraph,
            trace_networks: zip(traceNetworks, trace_networks).map(([tn, fctn]) => ({
              ...fctn,
              _views: tn.toDict()._views
            }))
          },
          ...fc
        }))
      )
    )
  );

  reload() {
    const {hashId} = this;
    this.metaLoadTask.update(hashId);
    this.contentLoadTask.update(hashId);
  }

  save(): Observable<FilesystemObject> {
    const {hashId} = this;
    return this.contentWithOnlyViewsUpdated$.pipe(
      first(),
      map(content =>
        new Blob(
          [JSON.stringify(content)],
          {type: MimeTypes.Graph}
        )
      ),
      switchMap(contentValue =>
        this.filesystemService.save(
          [hashId],
          {contentValue}
        )
      ),
      map(updatedFiles => updatedFiles[hashId])
    );
  }
}
