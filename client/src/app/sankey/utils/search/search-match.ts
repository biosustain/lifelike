/**
 * Postulates:
 * + Iterate all nested properties of links
 *   - Iterate trace/s links/nodes but not nested nodes/links/traces
 * + Iterate all nested properties of nodes but not nested nodes/links/traces
 *
 * Practicalities:
 * + would be nice to have iterator of iterators for results
 */
import { omit, slice, isObject, uniq, flatMap, pullAt, first } from 'lodash-es';

import { ExtendedWeakMap, ExtendedMap } from 'app/shared/utils/types';
import { prioritisedCompileFind, MatchPriority } from 'app/shared/utils/find/prioritised-find';
import { GraphTrace } from 'app/shared/providers/graph-type/interfaces';
import { isNotEmpty } from 'app/shared/utils';

import { indexByProperty } from '..';
import { Match, EntityType, SearchNode, SearchLink, MatchGenerator } from '../../interfaces/search';

/* NOTE:
    Be very carefull with those imports as they cannot have any DOM references
    since they are executed in a web worker enviroment.
    Faulty import will prevent the worker from compiling, returning the error of type:
     "document is undefined"
     "window is undefined"
     "alert is undefined"
*/


export class SankeySearch {
  constructor({
                searchTokens,
                data,
                options,
                networkTraceIdx
              }) {
    this.data = data;
    this.matcher = prioritisedCompileFind(searchTokens, options);
    this.matchedTraces = new ExtendedWeakMap<GraphTrace & any, Match[]>();
    this.matchedLink = new ExtendedMap<SearchLink['id'], [Match[], Generator<Match>]>();
    this.matchedNodes = new ExtendedMap<SearchNode['id'], [Match[], Generator<Match>]>();
    this.nodeById = indexByProperty(data.nodes, 'id');
    this.networkTraceIdx = networkTraceIdx;
  }

  data;
  networkTraceIdx: number;
  matcher: (term: string) => MatchPriority | boolean;
  matchedTraces: ExtendedWeakMap<GraphTrace & any, Match[]>;
  matchedLink: ExtendedMap<SearchLink['id'], [Match[], Generator<Match>]>;
  matchedNodes: ExtendedMap<SearchNode['id'], [Match[], Generator<Match>]>;
  nodeById: Map<string, SearchNode>;
  potentialEntitiesWithAdditionalMatches: MatchGenerator[] = [];

  private readonly ignoredNodeProperties: Array<keyof SearchNode> = [];
  private readonly ignoredLinkProperties: Array<keyof SearchLink> = [
    'source', 'target'
  ];
  private readonly ignoredTraceProperties: Array<keyof GraphTrace> = [
    'node_paths', 'edges'
  ];

  *matchKeyObject(obj, key) {
    for (const match of this.matchObject(obj)) {
      yield {
        path: [key, ...match.path],
        priority: match.priority,
        term: match.term
      } as Match;
    }
  }

  *matchObject(obj): Generator<Match> {
    if (Array.isArray(obj)) {
      for (const nestedObj of obj) {
        yield*this.matchObject(nestedObj);
      }
    } else if (isObject(obj)) {
      for (const [key, term] of Object.entries(obj)) {
        yield*this.matchKeyObject(term, key);
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

  matchNode(node: SearchNode) {
    return this.matchedNodes.getSetLazily(
      node.id,
      () => this.saveGeneratorResults(
        this.matchObject(
          omit(node, this.ignoredNodeProperties)
        )
      )
    );
  }

  matchLink(link: SearchLink): [Match[], Generator<Match, any, unknown>] {
    return this.matchedLink.getSetLazily(
      link.id,
      () => this.saveGeneratorResults(
        this.matchObject(
          omit(link, this.ignoredLinkProperties)
        )
      )
    );
  }

  *nodeIdsToNodes(nodeIds): Generator<SearchNode & any> {
    for (const nodeId of nodeIds) {
      yield this.nodeById.get(nodeId);
    }
  }

  *linkIdxsToLinks(linkIdxs): Generator<SearchLink & any> {
    for (const linkIdx of linkIdxs) {
      yield this.data.links[linkIdx];
    }
  }

  *matchTrace(trace: GraphTrace): Generator<Match> {
    yield*this.matchObject(
      omit(trace, this.ignoredTraceProperties)
    );
    const {node_paths, detail_edges, edges} = trace;
    // if (node_paths) {
    //   for (const nodeIds of node_paths) {
    //     for (const node of this.nodeIdsToNodes(nodeIds)) {
    //       for (const match of this.matchNode(node)) {
    //         yield {
    //           term: match.term,
    //           priority: match.priority,
    //           path: ['node paths', ...match.path]
    //         } as Match;
    //       }
    //     }
    //   }
    // }
    if (detail_edges) {
      for (const detailEdge of detail_edges) {
        for (const node of this.nodeIdsToNodes(slice(detailEdge, 0, 2))) {
          const [precomputed, generator] = this.matchNode(node);
          for (const match of precomputed) {
            yield {
              term: match.term,
              priority: match.priority,
              path: ['detail edges', ...match.path]
            } as Match;
          }
          for (const match of generator) {
            yield {
              term: match.term,
              priority: match.priority,
              path: ['detail edges', ...match.path]
            } as Match;
          }
        }
      }
    }
    // if (edges) {
    //   for (const link of this.linkIdxsToLinks(edges)) {
    //     for (const match of this.matchLink(link)) {
    //       yield {
    //         term: match.term,
    //         priority: match.priority,
    //         path: ['edges', ...match.path]
    //       } as Match;
    //     }
    //   }
    // }
  }

  saveGeneratorResults<T>(iterator: Iterable<T>): [T[], Generator<T>] {
    const calculatedMatches = [];

    function*matchGenerator() {
      for (const match of iterator) {
        calculatedMatches.push(match);
        yield match;
      }
    }

    return [calculatedMatches, matchGenerator()];
  }

  *traverseData({nodes, links, traces}): Generator<any> {
    // keep track iterators wich returned match
    const {potentialEntitiesWithAdditionalMatches} = this;
    for (const node of nodes) {
      const [precomputed, matchGenerator] = this.matchNode(node);
      if (isNotEmpty(precomputed)) {
        yield {
          type: EntityType.Node,
          id: node.id,
          value: first(precomputed)
        };
      } else {
        const {value, done} = matchGenerator.next();
        if (!done) {
          potentialEntitiesWithAdditionalMatches.push({
            type: EntityType.Node,
            id: node.id,
            matchGenerator
          });
          yield {
            type: EntityType.Node,
            id: node.id,
            value
          };
        }
      }
    }
    for (const link of links) {
      const [precomputed, matchGenerator] = this.matchLink(link);
      if (isNotEmpty(precomputed)) {
        yield {
          type: EntityType.Link,
          id: link.id,
          value: first(precomputed)
        };
      } else {
        const {value, done} = matchGenerator.next();
        if (!done) {
          potentialEntitiesWithAdditionalMatches.push({
            type: EntityType.Link,
            id: link.id,
            matchGenerator
          });
          yield {
            type: EntityType.Link,
            id: link.id,
            value
          };
        }
      }
    }
    // for (const [id, trace] of traces.entries()) {
    //   const matchGenerator = this.matchTrace(trace);
    //   const {value, done} = matchGenerator.next();
    //   if (!done) {
    //     potentialEntitiesWithAdditionalMatches.push({
    //       type: EntityType.Trace,
    //       id,
    //       matchGenerator
    //     });
    //     yield {
    //       type: EntityType.Trace,
    //       id,
    //       value
    //     };
    //   }
    // }
  }

  getNetworkTraceData({links, nodes}, traces) {
    const linkIdxs = uniq(flatMap(traces, trace => trace.edges));
    const _links = linkIdxs.map(idx => links[idx]);
    const nodeIds = uniq(flatMap(_links, link => [link.source, link.target]));
    const {nodeById} = this;
    const _nodes = uniq(flatMap(_links, link => [link.source, link.target])).map(id => nodeById.get(id));
    return {links: _links, nodes: _nodes, traces};
  }

  *getFirstMatchForEachEntity(traceNetworks, networkTraceIdxMap): Generator<Match> {
    for (const traceNetwork of traceNetworks) {
      const {traces} = traceNetwork;
      const traceNetworkData = this.getNetworkTraceData(this.data, traces);
      const networkTraceIdx = networkTraceIdxMap.get(traceNetwork);
      yield*this.addNetworkTraceIdx(
        networkTraceIdx,
        this.traverseData(traceNetworkData)
      );
    }
  }

  *getRemainingMatchesForEachEntity(): Generator<Match> {
    for (const {matchGenerator, ...rest} of this.potentialEntitiesWithAdditionalMatches) {
      for (const matchUpdate of matchGenerator) {
        yield {
          ...matchUpdate,
          ...rest
        };
      }
    }
  }

  *addNetworkTraceIdx(networkTraceIdx, iterator) {
    for (const match of iterator) {
      yield {
        networkTraceIdx,
        ...match
      };
    }
  }

  traverseAll() {
    const {data: {graph: {trace_networks}}, networkTraceIdx: currentNetworkTraceIdx} = this;
    // map netwrok traces to their idxs
    const networkTraceIdxMap = new Map(trace_networks.map((v, i) => [v, i]));
    // make networkTraceIdx first to iterate
    const [currentNetworkTrace] = pullAt(trace_networks, currentNetworkTraceIdx);
    trace_networks.unshift(currentNetworkTrace);

    return [
      this.getFirstMatchForEachEntity(trace_networks, networkTraceIdxMap),
      this.getRemainingMatchesForEachEntity()
    ];
  }
}
