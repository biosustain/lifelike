/**
 * Postulates:
 * + Iterate all nested properties of links
 *   - Iterate trace/s links/nodes but not nested nodes/links/traces
 * + Iterate all nested properties of nodes but not nested nodes/links/traces
 *
 * Practicalities:
 * + would be nice to have iterator of iterators for results
 */
import { omit, slice, transform, isObject, flatMapDeep, uniq, flatMap, pullAt } from 'lodash-es';

import { ExtendedWeakMap, LazyLoadedMap } from 'app/shared/utils/types';
import { prioritisedCompileFind, MatchPriority } from 'app/shared/utils/find/prioritised-find';
import { GraphLink, GraphTrace, GraphNode } from 'app/shared/providers/graph-type/interfaces';

import { SankeyTrace, SankeyLink, SankeyNode } from '../pure_interfaces';

/* NOTE:
    Be very carefull with those imports as they cannot have any DOM references
    since they are executed in a web worker enviroment.
    Faulty import will prevent the worker from compiling, returning the error of type:
     "document is undefined"
     "window is undefined"
     "alert is undefined"
*/

export interface Match {
  path: string[];
  term: string | number;
  priority: MatchPriority;
  networkTraceIdx?: number;
}

enum LAYERS {
  link = 'link',
  node = 'node',
  trace = 'trace'
}

export interface SearchEntity {
  networkTraceIdx?: number;
  traceIdx?: number;
  nodeId?: string | number;
  linkId?: string | number;
  calculatedMatches: Match[];
  term: string;
}

export class SankeySearch {
  constructor({
                searchTokens,
                data,
                options,
                networkTraceIdx
              }) {
    this.data = data;
    this.networkTraceIdx = networkTraceIdx;
    this.matcher = prioritisedCompileFind(searchTokens, options);

    this.cleanCache();
    this.setNodeById();
    this.traceNetworksMapping = undefined;
  }

  get traceNetworksMapping() {
    if (!this._traceNetworksMapping) {
      this._traceNetworksMapping = this.getTraceNetworkMapping();
    }
    return this._traceNetworksMapping;
  }

  set traceNetworksMapping(traceNetworkMapping) {
    this._traceNetworksMapping = traceNetworkMapping;
  }

  searchTokens;
  networkTraceIdx;
  matcher;
  data;
  options;

  private readonly ignoredNodeProperties: Array<keyof GraphNode> = [];
  private readonly ignoredLinkProperties: Array<keyof GraphLink> = [
    'source', 'target'
  ];
  private readonly ignoredTraceProperties: Array<keyof GraphTrace> = [];

  private matchedTraces: ExtendedWeakMap<SankeyTrace & any, Match[]>;
  private matchedNodes: LazyLoadedMap<SankeyNode['_id'], Generator<Match>>;
  private matchedLink: LazyLoadedMap<SankeyLink['_id'], Generator<Match>>;
  private nodeById: Map<string, SankeyNode>;

  _traceNetworksMapping;

  traceNetwork = new WeakMap();

  cleanCache() {
    this.matchedTraces = new ExtendedWeakMap();
    this.matchedLink = new LazyLoadedMap();
    this.matchedNodes = new LazyLoadedMap();
  }

  getTraceNetworkMapping() {
    return this.data.graph.trace_networks.map((traceNetwork, networkTraceIdx) => ({
      networkTraceIdx,
      nodesId: flatMapDeep(traceNetwork.traces, ({node_paths}) => node_paths),
      linksId: flatMapDeep(traceNetwork.traces, ({edges}) => edges),
    }));
  }

  setNodeById() {
    this.nodeById = transform(this.data.nodes, (acc, n) => acc.set(n.id, n), new Map());
  }

  * matchKeyObject(obj, key) {
    for (const match of this.matchObject(obj)) {
      yield {
        path: [key, ...match.path],
        priority: match.priority,
        term: match.term
      } as Match;
    }
  }

  * matchObject(obj): Generator<Match> {
    if (Array.isArray(obj)) {
      for (const nestedObj of obj) {
        yield* this.matchObject(nestedObj);
      }
    } else if (isObject(obj)) {
      for (const [key, term] of Object.entries(obj)) {
        yield* this.matchKeyObject(term, key);
      }
    } else {
      const match = this.matcher(obj);
      if (match) {
        yield {
          term: obj,
          path: [],
          priority: match
        } as Match;
      }
    }
  }

  matchNode(node: SankeyNode, _context): Generator<Match> {
    return this.matchedNodes.getSet(
      node._id,
      () => this.matchObject(
        omit(node, this.ignoredNodeProperties)
      )
    );
  }

  * matchLink(link: (SankeyLink & any), {layers}): Generator<Match> {
    const matches = this.matchedLink.getSet(
      link._id,
      () => this.matchObject(
        omit(link, this.ignoredLinkProperties)
      )
    );
    yield* matches;
    const context = {
      layers: {
        ...layers,
        [LAYERS.link]: true
      }
    };
    if (!layers[LAYERS.link]) {
      // const {_trace, _traces} = link;
      // for (const trace of (_traces || _trace && [_trace] || [])) {
      //   const matchedTrace = this.matchedTraces.getSet(trace, []);
      //   for (const mt of this.matchTrace(trace, context)) {
      //     matchedTrace.push(mt);
      //   }
      //   for (const mm of matchedTrace) {
      //     yield {
      //       term: mm.term,
      //       priority: mm.priority,
      //       path: ['trace', ...mm.path]
      //     } as Match;
      //   }
      // }
    }
  }

  * nodeIdsToNodes(nodeIds): Generator<SankeyNode & any> {
    for (const nodeId of nodeIds) {
      yield this.nodeById.get(nodeId);
    }
  }

  * linkIdxsToLinks(linkIdxs): Generator<SankeyLink & any> {
    for (const linkIdx of linkIdxs) {
      yield this.data.links[linkIdx];
    }
  }

  * matchTrace(trace: SankeyTrace, {layers}): Generator<Match> {
    yield* this.matchObject(
      omit(trace, this.ignoredTraceProperties)
    );
    const context = {
      layers: {
        ...layers,
        [LAYERS.trace]: true
      }
    };
    if (!layers[LAYERS.trace]) {
      const {node_paths, detail_edges, edges} = trace;
      if (node_paths) {
        for (const nodeIds of node_paths) {
          for (const node of this.nodeIdsToNodes(nodeIds)) {
            for (const match of this.matchNode(node, context)) {
              yield {
                term: match.term,
                priority: match.priority,
                path: ['node paths', ...match.path]
              } as Match;
            }
          }
        }
      }
      if (detail_edges) {
        for (const detailEdge of detail_edges) {
          for (const node of this.nodeIdsToNodes(slice(detailEdge, 0, 2))) {
            for (const match of this.matchNode(node, context)) {
              yield {
                term: match.term,
                priority: match.priority,
                path: ['detail edges', ...match.path]
              } as Match;
            }
          }
        }
      }
      if (edges) {
        for (const link of this.linkIdxsToLinks(edges)) {
          for (const match of this.matchLink(link, context)) {
            yield {
              term: match.term,
              priority: match.priority,
              path: ['edges', ...match.path]
            } as Match;
          }
        }
      }
    }
  }

  saveGeneratorResults(iterator): [any[], Generator] {
    const calculatedMatches = [];

    function* matchGenerator() {
      for (const match of iterator) {
        calculatedMatches.push(match);
        yield match;
      }
    }

    return [calculatedMatches, matchGenerator()];
  }

  * traverseData({nodes, links}): Generator<SearchEntity & any> {
    const context = {
      layers: {}
    };
    for (const node of nodes) {
      const [calculatedMatches, matchGenerator] = this.saveGeneratorResults(this.matchNode(node, context));
      if (matchGenerator.next().value) {
        yield {
          nodeId: node._id,
          calculatedMatches,
          matchGenerator
        };
      }
    }
    for (const link of links) {
      const [calculatedMatches, matchGenerator] = this.saveGeneratorResults(this.matchLink(link, context));
      if (matchGenerator.next().value) {
        yield {
          linkId: link._id,
          calculatedMatches,
          matchGenerator
        };
      }
    }
  }

  getNetworkTraceData({links, nodes}, traces) {
    const linkIdxs = uniq(flatMap(traces, trace => trace.edges));
    const _links = linkIdxs.map(idx => links[idx]);
    const nodeIds = uniq(flatMap(_links, link => [link.source, link.target]));
    const {nodeById} = this;
    const _nodes = uniq(flatMap(_links, link => [link.source, link.target])).map(id => nodeById.get(id));
    return {links: _links, nodes: _nodes};
  }

  * traverseAll(): Generator<SearchEntity> {
    const {data: {graph: {trace_networks}}, networkTraceIdx: currentNetworkTraceIdx} = this;
    // map netwrok traces to their idxs
    const networkTraceIdxMap = new Map(trace_networks.map((v, i) => [v, i]));
    // make networkTraceIdx first to iterate
    const [currentNetworkTrace] = pullAt(trace_networks, currentNetworkTraceIdx);
    trace_networks.unshift(currentNetworkTrace);

    for (const traceNetwork of trace_networks) {
      const {traces} = traceNetwork;
      const traceNetworkData = this.getNetworkTraceData(this.data, traces);
      const networkTraceIdx = networkTraceIdxMap.get(traceNetwork);
      for (const match of this.traverseData(traceNetworkData)) {
        yield {
          networkTraceIdx,
          ...match
        };
      }
      for (const [traceIdx, trace] of traces.entries()) {
        const context = {
          layers: {
            [LAYERS.trace]: true
          }
        };
        const [calculatedMatches, matchGenerator] = this.saveGeneratorResults(this.matchTrace(trace, context));
        if (matchGenerator.next().value) {
          yield {
            traceIdx,
            calculatedMatches,
            matchGenerator
          } as (SearchEntity & any);
        }
      }
    }
  }
}
