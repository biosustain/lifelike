import { assign, mapValues, entries, max, isNumber } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { GraphNodeSets } from 'app/shared/providers/graph-type/interfaces';
import { isNotEmpty } from 'app/shared/utils';

import { SankeyFile, SankeyTraceNetwork, SankeyId } from '../interfaces';
import { indexByProperty } from '../utils';
import { SankeyView } from '../interfaces/view';

class View {
  state: any;
  size: any;
  nodes: any;
  links: any;
  base: any;
  private document;

  constructor({state, base, size, nodes, links}, document) {
    this.document = document;
    this.state = state;
    this.base = base;
    this.size = size;
    this.nodes = nodes;
    this.links = links;
  }
}

class Trace {
  color: any;
  group: any;
  edges: any;

  constructor({_color, _group, edges}) {
    this.color = _color;
    this.group = _group;
    this.edges = edges;
  }
}

export class TraceNetwork {
  traces: Trace[];
  views$: BehaviorSubject<{ [key: string]: View }>;
  private document;
  _sources: any;
  _targets: any;
  sources: any;
  targets: any;
  defaultSizing: any;
  _defaultSizing: any;
  description: string;
  name: string;

  constructor({traces, sources, targets, default_sizing, name, description, _views}: SankeyTraceNetwork, {nodeSets, sizing}, document) {
    this.document = document;
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
    this.views$ = new BehaviorSubject(mapValues(_views, view => new View(view, document)));
    document.isDirty$.subscribe(this.views$.pipe(map(() => false)));
  }

  addView(name: string, view: SankeyView) {
    this.views$.next({...this.views$.value, [name]: new View(view, this.document)});
  }

  toString() {
    return JSON.stringify({
      traces: this.traces,
      _views: this.views$.value,
      sources: this._sources,
      targets: this._targets,
    });
  }
}

class NodeSets {
  constructor(nodeSets: GraphNodeSets, document) {
    entries(nodeSets).forEach(([key, value]) => {
      this[`_${key}`] = value;
      this[key] = value.map(id => document.nodeById.get(id));
    });
  }

  toString() {
    return JSON.stringify(this);
  }
}

class SankeyGraph {
  traceNetworks: TraceNetwork[];
  nodeSets;
  private readonly document;
  sizing: any;

  constructor({trace_networks, sizing = {}, node_sets}, document) {
    this.document = document;
    this.sizing = sizing;
    this.nodeSets = new NodeSets(node_sets, document);
    this.traceNetworks = trace_networks.map(traceNetwork => new TraceNetwork(traceNetwork, this, document));
  }

  toString() {
    return JSON.stringify({
      trace_networks: this.traceNetworks,
      node_sets: this.nodeSets
    });
  }
}

class SankeyNode {
  id: any;

  constructor(node, id) {
    assign(this, node);
    this.id = id;
  }
}

class SankeyLink {
  id: any;

  constructor(link, id) {
    assign(this, link);
    this.id = id;
  }
}

export class SankeyDocument {
  nodes: SankeyNode[];
  links: SankeyLink[];
  graph: SankeyGraph;
  nodeById: Map<SankeyId, SankeyNode>;
  isDirty$: BehaviorSubject<boolean>;

  constructor({nodes, links, graph}: SankeyFile) {
    this.nodeById = indexByProperty(nodes, '_id');
    this.isDirty$ = new BehaviorSubject(false);

    this.nodes = nodes.map(node => new SankeyNode(node, node.id));
    this.links = links.map((link, index) => new SankeyLink(link, index));
    this.graph = new SankeyGraph(graph, this);
  }

  toString() {
    return JSON.stringify({
      nodes: this.nodes,
      links: this.links,
      graph: this.graph
    });
  }
}
