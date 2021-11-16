/**
 * Postulates:
 * + Iterate all nested properties of links
 *   - Iterate trace/s links/nodes but not nested nodes/links/traces
 * + Iterate all nested properties of nodes but not nested nodes/links/traces
 *
 * Practicalities:
 * + would be nice to have iterator of iterators for results
 */
import { omit, slice, transform, isObject } from 'lodash-es';

import { compileFind } from 'app/shared/utils/find';
import { SankeyLink, SankeyTrace, SankeyNode } from 'app/shared-sankey/interfaces';


export interface Match {
  path: string[];
  term: string | number;
}

enum LAYERS {
  link = 'link',
  node = 'node',
  trace = 'trace'
}

export class SankeySearch {
  matcher;
  dataToSearch;
  data;
  terms;
  options;

  private readonly nodePropertiesContainingEntities: Array<keyof (SankeyNode & any)> = [
    '_sourceLinks', '_targetLinks'
  ];
  private readonly linkPropertiesContainingEntities: Array<keyof (SankeyLink & any)> = [
    '_source', '_target', '_trace', '_traces'
  ];
  private readonly tracePropertiesContainingEntities: Array<keyof (SankeyTrace & any)> = [
    'edges'
  ];

  private matchedTraces: WeakMap<SankeyTrace & any, any>;
  private nodeById: Map<string, SankeyNode>;

  cleanCache() {
    this.matchedTraces = new WeakMap();
  }

  update(updateObj) {
    this.cleanCache();
    Object.assign(this, updateObj);
    if (updateObj.data) {
      this.setNodeById();
    }
    if (updateObj.terms && updateObj.options) {
      this.setMatcher();
    }
  }

  setMatcher() {
    this.matcher = compileFind(this.terms, this.options);
  }

  setNodeById() {
    this.nodeById = transform(this.data.nodes, (acc, n) => acc.set(n.id, n), new Map());
  }

  * matchKeyObject(obj, key) {
    for (const match of this.matchObject(obj)) {
      yield {
        path: [key, ...match.path],
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
    } else if (this.matcher(obj)) {
      yield {
        term: obj,
        path: []
      } as Match;
    }
  }

  matchNode(node: SankeyNode, _context): Generator<Match> {
    return this.matchObject(
      omit(node, this.nodePropertiesContainingEntities)
    );
  }

  * matchLink(link: (SankeyLink & any), {layers}): Generator<Match> {
    yield* this.matchObject(
      omit(link, this.linkPropertiesContainingEntities)
    );
    const context = {
      layers: {
        ...layers,
        [LAYERS.link]: true
      }
    };
    if (!layers[LAYERS.link]) {
      const {_trace, _traces} = link;
      for (const trace of (_traces || [_trace])) {
        let matchedTrace = this.matchedTraces.get(trace);
        if (!matchedTrace) {
          matchedTrace = [];
          this.matchedTraces.set(trace, matchedTrace);
        }
        for (const mt of this.matchTrace(trace, context)) {
          matchedTrace.push(mt);
        }
        for (const mm of matchedTrace) {
          yield {
            term: mm.term,
            path: ['trace', ...mm.path]
          } as Match;
        }
      }
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
      omit(trace, this.tracePropertiesContainingEntities)
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

  * traverseAll(): Generator<any> {
    const context = {
      layers: {}
    };
    for (const node of this.dataToSearch.nodes) {
      const [calculatedMatches, matchGenerator] = this.saveGeneratorResults(this.matchNode(node, context));
      if (matchGenerator.next().value) {
        yield {
          nodeId: node._id,
          calculatedMatches,
          matchGenerator
        };
      }
    }
    for (const link of this.dataToSearch.links) {
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
}
