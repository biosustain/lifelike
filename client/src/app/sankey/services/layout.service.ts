import { Injectable, OnDestroy } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { merge, omit, isNil, clone, range } from 'lodash-es';
import { map, tap, switchMap, shareReplay, filter, startWith, pairwise, takeUntil } from 'rxjs/operators';
import { combineLatest, iif, ReplaySubject, Observable, Subject } from 'rxjs';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyState, NetworkTraceData, SankeyNode, SankeyLink } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { debug } from 'app/shared/rxjs/debug';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { ExtendedMap, ExtendedArray } from 'app/shared/utils/types';

import { SankeyBaseState, SankeyBaseOptions, SankeyNodeHeight } from '../base-views/interfaces';
import { BaseControllerService } from './base-controller.service';
import { symmetricDifference, normalizeGenerator } from '../utils';
import { SankeyAbstractLayoutService, LayoutData } from '../abstract/sankey-layout.service';
import { ErrorMessages } from '../constants/error';
import { ValueGenerator } from '../interfaces/valueAccessors';
import { Prescaler } from '../interfaces/prescalers';
import { SankeyNodesOverwrites, SankeyLinksOverwrites } from '../interfaces/view';

export const groupByTraceGroupWithAccumulation = () => {
  const traceGroupOrder = new Set();
  return links => {
    links.forEach(({_trace}) => {
      traceGroupOrder.add(_trace._group);
    });
    const groups = [...traceGroupOrder];
    return links.sort((a, b) =>
      (groups.indexOf(a._trace._group) - groups.indexOf(b._trace._group))
    );
  };
};

// https://sbrgsoftware.atlassian.net/browse/LL-3732
export const DEFAULT_FONT_SIZE = 12 * 1.60;

export type DefaultLayoutService = LayoutService<SankeyBaseOptions, SankeyBaseState>;

/**
 * Helper so we can create columns copy with minimum overhead
 */
const copy2DArray = (arr: any[][]) => arr.map(clone);

type NodeColumns = SankeyNode[][];

export interface LayersContext<Data extends NetworkTraceData = NetworkTraceData> {
  columns: Data['nodes'][];
  x: number;
}

interface VirtualNodesContext<Data extends NetworkTraceData = NetworkTraceData> {
  nodesAndPlaceholders: Data['nodes'];
  columnsWithLinkPlaceholders: Data['nodes'][];
}

interface VerticalContext {
  y0: number;
  y1: number;
  ky: number;
  py: number;
  height: number;
  nodeHeight: SankeyNodeHeight;
}

@Injectable()
export class LayoutService<Options extends SankeyBaseOptions, State extends SankeyBaseState> extends SankeyAbstractLayoutService
  implements ServiceOnInit, OnDestroy {
  constructor(
    readonly baseView: BaseControllerService<Options, State>,
    readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService
  ) {
    super(truncatePipe);
  }

  get nodeColor() {
    return ({_sourceLinks, _targetLinks, _color}: SankeyNode) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);
      // if there is only one trace start/end then color node with its color
      if (difference.size === 1) {
        return difference.values().next().value._trace._color;
      } else {
        return _color;
      }
    };
  }

  destroyed$ = new Subject();

  linkPath$ = this.baseView.common.normalizeLinks$.pipe(
    map(normalizeLinks => {
      const {calculateLinkPathParams, composeLinkPath} = this;
      return link => {
        link._calculated_params = calculateLinkPathParams(link, normalizeLinks);
        return composeLinkPath(link._calculated_params);
      };
    })
  );

  nodeLabel$ = this.baseView.common.labelEllipsis$.pipe(
    map(({value, enabled}) => {
      const {nodeLabel, truncatePipe: {transform}} = this;
      if (enabled) {
        return {
          nodeLabelShort: (d, i?, n?) => transform(nodeLabel(d, i, n), value),
          nodeLabelShouldBeShorted: (d, i?, n?) => nodeLabel(d, i, n).length > value
        };
      } else {
        return {
          nodeLabelShort: (d, i?, n?) => nodeLabel(d, i, n),
          nodeLabelShouldBeShorted: () => false
        };
      }
    }),
  );

  fontSize$ = this.baseView.common.fontSizeScale$.pipe(
    map(fontSizeScale =>
      // noinspection JSUnusedLocalSymbols
      (d?, i?, n?) => DEFAULT_FONT_SIZE * fontSizeScale
    )
  );

  state$: Partial<SankeyState>;
  baseState$: Partial<SankeyBaseState>;

  graph$: Observable<NetworkTraceData<SankeyNode, SankeyLink>> = this.baseView.common.view$.pipe(
    // ensure no calculation of view if base view changed
    takeUntil(this.destroyed$),
    // todo temporary fixes needs to work but do not know how to make it better
    startWith(undefined),
    pairwise(),
    map(([previousView, view]) => {
      // reset zoom adjustments after leaving the view
      if (!isNil(previousView) && isNil(view)) {
        this.zoomAdjustment$.next({zoom: 1});
      }
      return view;
    }),
    // temporary fixes end
    switchMap(view =>
      iif(
        () => isNil(view),
        this.calculateLayout$,
        this.recreateLayout(view)
      )
    ),
    debug('graph$'),
    shareReplay(1)
  );

  zoomAdjustment$ = new ReplaySubject<{ zoom: number, x0?: number, y0?: number }>(1);

  takeUntilViewChange = takeUntil(this.baseView.common.view$);

  private calculateLayout$;

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  positionNodes(x) {
    return switchMap(data => this.horizontal$.pipe(
      // calculate width change ratio for repositioning of the nodes
      startWith({} as any),
      pairwise(),
      map(([prevHorizontal, horizontal], callIndex) => {
        if (callIndex === 0) {
          // Absolute node positioning
          this.positionNodesHorizontaly(data, horizontal, x);
        } else {
          const prevWidth = prevHorizontal?.width ?? horizontal.width;
          const widthChangeRatio = horizontal.width / prevWidth;

          // Relative node positioning (to preserve draged node position)
          this.repositionNodesHorizontaly(data, horizontal, widthChangeRatio);
        }
        return data;
      })
    ));
  }

  computeLinkBreadths(nodesAndPlaceholders) {
    return tap(x => {
      for (const node of nodesAndPlaceholders) {
        let y0 = node._y0;
        let y1 = y0;
        for (const link of node._sourceLinks) {
          link._y0 = y0 + link._width / 2;
          // noinspection JSSuspiciousNameCombination
          y0 += link._width;
        }
        for (const link of node._targetLinks) {
          link._y1 = y1 + link._width / 2;
          // noinspection JSSuspiciousNameCombination
          y1 += link._width;
        }
      }
    });
  }

  assignValues(data) {
    return combineLatest([
      this.baseView.nodeValueAccessor$,
      this.baseView.linkValueAccessor$,
      this.baseView.common.prescaler$
    ]).pipe(
      filter<[ValueGenerator, ValueGenerator, Prescaler]>(params => params.every(param => !!param)),
      tap(([nodeValueAccessor, linkValueAccessor, prescaler]) => {

        const preprocessedLinks = linkValueAccessor.preprocessing.call(this, data) ?? {};
        const preprocessedNodes = nodeValueAccessor.preprocessing.call(this, data) ?? {};

        Object.assign(
          data,
          preprocessedLinks,
          preprocessedNodes,
          merge(
            omit(preprocessedLinks, ['nodes', 'links']),
            omit(preprocessedNodes, ['nodes', 'links'])
          )
        );

        let minValue = data.nodes.reduce((m, n) => {
          if (n._value !== undefined) {
            n._value = prescaler.fn(n._value);
            return Math.min(m, n._value);
          }
          return m;
        }, 0);
        minValue = data.links.reduce((m, l) => {
          l._value = prescaler.fn(l._value);
          if (l._multiple_values) {
            l._multiple_values = l._multiple_values.map(prescaler.fn) as [number, number];
            return Math.min(m, ...l._multiple_values);
          }
          return Math.min(m, l._value);
        }, minValue);

        if (nodeValueAccessor.postprocessing) {
          Object.assign(data, nodeValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (linkValueAccessor.postprocessing) {
          Object.assign(data, linkValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (minValue < 0) {
          data.nodes.forEach(n => {
            if (n._value !== undefined) {
              n._value = n._value - minValue;
            }
          });
          data.links.forEach(l => {
            l._value = l._value - minValue;
            if (l._multiple_values) {
              l._multiple_values = l._multiple_values.map(v => v - minValue) as [number, number];
            }
          });
        }
      })
    );
  }

  /**
   * If link spawns on multiple columns (both normal and circular) on each intermediate
   * column place placeholder node with height of this link.
   * For best results this method places only one node with summed for all links going from the
   * same source to same target node.
   * This approach reduces overlays in more complex graphs
   */
  createVirtualNodes(data, columns) {
    const columnsWithLinkPlaceholders = copy2DArray(columns);
    // start to operate on list of nodes and virtual ones
    const nodesAndPlaceholders = clone(data.nodes);
    const _virtualPaths = new ExtendedMap<string, ExtendedArray<SankeyNode>>();

    for (const link of data.links) {
      let virtualPathStartLayer;
      let virtualPathEndLayer;
      if (link._circular) {
        virtualPathStartLayer = link._target._layer;
        virtualPathEndLayer = link._source._layer;
      } else {
        // if the link spans more than 1 column, then replace it with virtual nodes and links
        if (link._target._layer - link._source._layer > 1) {
          virtualPathStartLayer = link._source._layer;
          virtualPathEndLayer = link._target._layer;
        } else {
          continue;
        }
      }
      const id = link._source.id + ' ' + link._target.id;
      const virtualPath = _virtualPaths.getSet(id, new ExtendedArray());
      range(virtualPathStartLayer, virtualPathEndLayer).forEach(_layer =>
        virtualPath.getSetLazily(_layer, () => {
          const newNode = {
            _value: 0,
            _layer
          } as SankeyNode;
          columnsWithLinkPlaceholders[_layer].push(newNode);
          return newNode;
        })._value += link._value
      );
    }

    return {
      nodesAndPlaceholders,
      columnsWithLinkPlaceholders
    } as VirtualNodesContext;
  }

  /**
   * Same as parent method just ignoring circular links
   */
  computeNodeHeights(nodesAndPlaceholders) {
    return tap(({nodeHeight: {min: {enabled, value}}, ky}) => {
      const {value: valueAccessor} = this;
      for (const node of nodesAndPlaceholders) {
        if (enabled && value) {
          node._height = Math.max(valueAccessor(node) * ky, value);
        } else {
          node._height = valueAccessor(node) * ky;
        }
      }
    });
  }

  computeNodeBreadths(data, columns) {
    throw new Error();
  }

  layoutNodesWithinColumns(columns) {
    return tap(({ky, y0, y1, height}) =>
      columns.forEach(nodes => {
        const {length} = nodes;
        const nodesHeight = sum(nodes, ({_height}) => _height);
        // do we want space above and below nodes or should it fill column till the edges?
        const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
        const freeSpace = height - nodesHeight;
        const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
        let y = additionalSpacers ? spacerSize + y0 : y0;
        // nodes are placed in order from tree traversal
        nodes.sort((a, b) => a._order - b._order).forEach(node => {
          const nodeHeight = node._height;
          node._y0 = y;
          node._y1 = y + nodeHeight;
          y += nodeHeight + spacerSize;

          // apply the y scale on links
          for (const link of node._sourceLinks) {
            link._width = link._value * ky;
          }
        });
        for (const {_sourceLinks, _targetLinks} of nodes) {
          _sourceLinks.sort(this.linkSort);
          _targetLinks.sort(this.linkSort);
        }
      })
    );
  }

  getVerticalLayoutParams$(nodesAndPlaceholders, columnsWithLinkPlaceholders: NodeColumns) {
    return combineLatest([
      this.baseView.nodeHeight$,
      this.vertical$
    ]).pipe(
      map(([nodeHeight, {height, y0, y1}]) => {
          const {dy, py, dx, value} = this;

          // normal calculation based on tallest column
          let ky = min(columnsWithLinkPlaceholders, c => (height - (c.length - 1) * py) / sum(c, value));
          if (nodeHeight.max.enabled) {
            const maxCurrentHeight = max(nodesAndPlaceholders, value) * ky;
            if (nodeHeight.max.ratio) {
              const maxScaling = dx * nodeHeight.max.ratio / maxCurrentHeight;
              if (maxScaling < 1) {
                ky *= maxScaling;
              }
            }
          }
          return {
            ky,
            height,
            y0,
            y1,
            nodeHeight,
            // readjust py for current context
            py: Math.min(dy, height / (max(columnsWithLinkPlaceholders, (c: Array<any>) => c.length) - 1))
          } as VerticalContext;
        }
      ),
      debug('setVerticalLayoutParams')
    );
  }

  computeNodeLayers(data) {
    return this.baseView.common.align$.pipe(
      map(align => {
        const {dx} = this;
        const {nodes} = data as LayoutData;
        const x = max(nodes, d => d._depth) + 1; // Don't use Array.fill([]) as it will just copy ref to the same []
        const columns: SankeyNode[][] = new Array(x).fill(undefined).map(() => []);
        for (const node of nodes) {
          const i = Math.max(0, Math.min(x - 1, Math.floor(align.fn.call(null, node, x))));
          node._layer = i;
          columns[i].push(node);
        }
        if (this.nodeSort) {
          for (const column of columns) {
            column.sort(this.nodeSort);
          }
        }
        return {
          x,
          columns
        } as LayersContext;
      })
    );
  }

  onInit(): void {
    this.calculateLayout$ = this.baseView.networkTraceData$.pipe(
      // Calculate layout and address possible circular links
      // Associate the nodes with their respective links, and vice versa
      this.computeNodeLinks,
      debug('computeNodeLinks'),
      // Determine which links result in a circular path in the graph
      this.identifyCircles,
      debug('identifyCircles'),
      // Calculate the nodes' depth based on the incoming and outgoing links
      //     Sets the nodes':
      //     - depth:  the depth in the graph
      //     - column: the depth (0, 1, 2, etc), as is relates to visual position from left to right
      //     - x0, x1: the x coordinates, as is relates to visual position from left to right
      this.computeNodeDepths,
      debug('computeNodeDepths'),
      this.computeNodeReversedDepths,
      debug('computeNodeReversedDepths'),
      // After this method data becomes wrapped in context {data, ...context}
      switchMap(data => this.computeNodeLayers(data).pipe(
        switchMap(({columns, x}) =>
          // Calculate the nodes' values, based on the values of the incoming and outgoing links
          this.assignValues(data).pipe(
            debug('assignValues'),
            switchMap(() => {
              const {nodesAndPlaceholders, columnsWithLinkPlaceholders} = this.createVirtualNodes(data, columns);
              return this.getVerticalLayoutParams$(nodesAndPlaceholders, columnsWithLinkPlaceholders).pipe(
                this.computeNodeHeights(nodesAndPlaceholders),
                debug('computeNodeHeights'),
                // Calculate the nodes' and links' vertical position within their respective column
                //     Also readjusts sankeyCircular size if circular links are needed, and node x's
                tap(() => this.computeNodeBreadths(data, columns)),
                debug('computeNodeBreadths'),
                this.layoutNodesWithinColumns(columns),
                debug('layoutNodesWithinColumns'),
                this.computeLinkBreadths(nodesAndPlaceholders),
                debug('computeLinkBreadths'),
              );
            }),
            map(verticalContext => data),
            this.positionNodes(x),
            debug('positionNodes'),
          )
        )
      )),
      debug('calculateLayout'),
      // IMPORTANT!
      // If refCount is true, the source will be unsubscribed from once the reference count drops to zero,
      // i.e. the inner ReplaySubject will be unsubscribed. All new subscribers will receive value emissions
      // from a new ReplaySubject which in turn will cause a new subscription to the source observable.
      shareReplay({bufferSize: 1, refCount: true})
    );
  }

  calculateSizeFromNodesPosition(nodes) {
    // tslint:disable-next-line:one-variable-per-declaration
    let x0, x1, y0, y1;
    for (const {_x0, _x1, _y0, _y1} of nodes) {
      if (x0 === undefined || _x0 < x0) {
        x0 = _x0;
      }
      if (x1 === undefined || _x1 > x1) {
        x1 = _x1;
      }
      if (y0 === undefined || _y0 < y0) {
        y0 = _y0;
      }
      if (y1 === undefined || _y1 > y1) {
        y1 = _y1;
      }
    }
    return {
      x0, x1, y0, y1,
      width: x1 - x0,
      height: y1 - y0
    };
  }

  adjustViewToViewport(view) {
    return switchMap((data: NetworkTraceData<SankeyNode, SankeyLink>) => this.extent$.pipe(
      // calculate width change ratio for repositioning of the nodes
      startWith({} as any),
      pairwise(),
      map(([prevExtent, extent], callIndex) => {
        if (callIndex === 0) {
          // Absolute node positioning
          const {width: currentWidth, height: currentHeight} = extent;
          const graphSize = this.calculateSizeFromNodesPosition(data.nodes);
          const width = Math.max(view.size.width, graphSize.width) ?? currentWidth;
          const height = Math.max(view.size.height, graphSize.height) ?? currentHeight;
          const horizontalAdjustment = currentWidth / width;
          const verticalAdjustment = currentHeight / height;

          const x0 = -graphSize.x0 + this.dx;
          const y0 = -graphSize.y0 + this.dy;

          if (horizontalAdjustment > verticalAdjustment) {
            this.zoomAdjustment$.next({
              x0: x0 * horizontalAdjustment / verticalAdjustment, y0,
              zoom: verticalAdjustment
            });
            // if we zoom out to fit graph vertically then spread nodes on horizontal axis
            this.repositionNodesHorizontaly(
              data,
              extent,
              horizontalAdjustment / verticalAdjustment
            );
          } else {
            this.zoomAdjustment$.next({
              x0, y0,
              zoom: horizontalAdjustment
            });
          }
        } else {
          const prevWidth = prevExtent?.width ?? extent.width;
          const widthChangeRatio = extent.width / prevWidth;
          // Relative node positioning (to preserve draged node position)
          this.repositionNodesHorizontaly(data, extent, widthChangeRatio);
        }
        return data;
      })
    ));
  }

  recreateLayout(view) {
    return this.baseView.networkTraceData$.pipe(
      tap((data: NetworkTraceData) => {
        this.applyPropertyObject(view.nodes, data.nodes);
        this.applyPropertyObject(view.links, data.links);
      }),
      this.computeNodeLinks,
      // Adjust the zoom so view fits into viewport
      this.adjustViewToViewport(view)
    );
  }

  applyPropertyObject(
    propertyObject: SankeyNodesOverwrites | SankeyLinksOverwrites,
    entities: Array<SankeyNode | SankeyLink>
  ): void {
    // for faster lookup
    const entityById = new Map(entities.map((d, i) => [String(d._id), d]));
    Object.entries(propertyObject).map(([id, properties]) => {
      const entity = entityById.get(id);
      if (entity) {
        Object.assign(entity, properties);
      } else {
        this.warningController.warn(ErrorMessages.missingEntity(id));
      }
    });
  }

  calculateLinkPathParams(link, normalize = true) {
    const {_source, _target, _multiple_values} = link;
    let {_value: linkValue} = link;
    linkValue = linkValue || 1e-4;
    const sourceX = _source._x1;
    const targetX = _target._x0;
    const {_sourceLinks} = _source;
    const {_targetLinks} = _target;
    const sourceIndex = _sourceLinks.indexOf(link);
    const targetIndex = _targetLinks.indexOf(link);
    const columns = Math.abs(_target._layer - _source._layer);
    const linkWidth = Math.abs(targetX - sourceX);
    const bezierOffset = (link._circular ? linkWidth / columns : linkWidth) / 2;
    const sourceBezierX = sourceX + bezierOffset;
    const targetBezierX = targetX - bezierOffset;
    let sourceY0;
    let sourceY1;
    let targetY0;
    let targetY1;
    let sourceY = 0;
    let targetY = 0;

    for (let i = 0; i < sourceIndex; i++) {
      const nestedLink = _sourceLinks[i];
      sourceY += nestedLink._multiple_values?.[0] ?? nestedLink._value;
    }
    for (let i = 0; i < targetIndex; i++) {
      const nestedLink = _targetLinks[i];
      targetY += nestedLink._multiple_values?.[1] ?? nestedLink._value;
    }

    if (normalize) {
      let sourceValues;
      let targetValues;
      if (_multiple_values) {
        sourceValues = _sourceLinks.map(l => l._multiple_values?.[0] ?? l._value);
        targetValues = _targetLinks.map(l => l._multiple_values?.[1] ?? l._value);
      } else {
        sourceValues = _sourceLinks.map(({_value}) => _value);
        targetValues = _targetLinks.map(({_value}) => _value);
      }
      const sourceNormalizer = _sourceLinks._normalizer ?? (_sourceLinks._normalizer = normalizeGenerator(sourceValues));
      const targetNormalizer = _targetLinks._normalizer ?? (_targetLinks._normalizer = normalizeGenerator(targetValues));
      const sourceHeight = _source._y1 - _source._y0;
      const targetHeight = _target._y1 - _target._y0;

      sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + _source._y0;
      targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + _target._y0;
      if (_multiple_values) {
        sourceY1 = (sourceNormalizer.normalize(_multiple_values[0]) * sourceHeight) + sourceY0;
        targetY1 = (targetNormalizer.normalize(_multiple_values[1]) * targetHeight) + targetY0;
      } else {
        sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
        targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
      }
    } else {
      let {_width} = link;
      _width = _width || 1e-4;
      const valueScaler = _width / linkValue;

      sourceY0 = sourceY * valueScaler + _source._y0;
      targetY0 = targetY * valueScaler + _target._y0;
      if (_multiple_values) {
        sourceY1 = _multiple_values[0] * valueScaler + sourceY0;
        targetY1 = _multiple_values[1] * valueScaler + targetY0;
      } else {
        sourceY1 = linkValue * valueScaler + sourceY0;
        targetY1 = linkValue * valueScaler + targetY0;
      }
    }
    return {
      sourceX,
      sourceY0,
      sourceY1,
      targetX,
      targetY0,
      targetY1,
      sourceBezierX,
      targetBezierX
    };
  }

  /**
   * Compose SVG path based on set of intermediate points
   */
  composeLinkPath({
                    sourceX,
                    sourceY0,
                    sourceY1,
                    targetX,
                    targetY0,
                    targetY1,
                    sourceBezierX,
                    targetBezierX
                  }) {
    return (
      `M${sourceX} ${sourceY0}` +
      `C${sourceBezierX} ${sourceY0},${targetBezierX} ${targetY0},${targetX} ${targetY0}` +
      `L${targetX} ${targetY1}` +
      `C${targetBezierX} ${targetY1},${sourceBezierX} ${sourceY1},${sourceX} ${sourceY1}` +
      `Z`
    );
  }

  linkSort = (a, b) => (
    // sort by order given in tree traversal
    (a._source._order - b._source._order) ||
    (a._target._order - b._target._order) ||
    (a._order - b._order)
  )

  /**
   * Iterate over nodes and recursively reiterate on the ones they are connecting to.
   * @param nodes - set of nodes to start iteration with
   * @param nextNodeProperty - property of link pointing to next node (_source, _target)
   * @param nextLinksProperty - property of node pointing to next links (_sourceLinks, _targetLinks)
   */
  getPropagatingNodeIterator = function*(nodes, nextNodeProperty, nextLinksProperty): Generator<[SankeyNode, number]> {
    const n = nodes.length;
    let current = new Set<SankeyNode>(nodes);
    let next = new Set<SankeyNode>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        yield [node, x];
        for (const link of node[nextLinksProperty]) {
          if (!link._circular) {
            next.add(link[nextNodeProperty] as SankeyNode);
          }
        }
      }
      if (++x > n) {
        throw new Error('Unaddressed circular link');
      }
      current = next;
      next = new Set();
    }
  };
}
