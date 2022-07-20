import { Injectable, OnDestroy } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { merge, omit, isNil, clone, range, isEqual, assign, flatMap, chain, map as lodashMap } from 'lodash-es';
import { map, tap, switchMap, shareReplay, filter, takeUntil, catchError, first, distinctUntilChanged } from 'rxjs/operators';
import { combineLatest, iif, ReplaySubject, Subject, EMPTY, Observable, of, BehaviorSubject, OperatorFunction } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyState, TypeContext } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { debug } from 'app/shared/rxjs/debug';
import { ServiceOnInit } from 'app/shared/schemas/common';
import { ExtendedMap, ExtendedArray } from 'app/shared/utils/types';
import { median } from 'app/shared/utils/math';

import { SankeyBaseState, SankeyNodeHeight } from '../base-views/interfaces';
import { BaseControllerService } from './base-controller.service';
import { normalizeGenerator } from '../utils';
import { SankeyAbstractLayoutService, LayoutData, ProcessedExtent, Horizontal, Vertical } from '../abstract/sankey-layout.service';
import { ErrorMessages } from '../constants/error';
import { ValueGenerator } from '../interfaces/valueAccessors';
import { EditService } from './edit.service';
import { View, SankeyNode, SankeyDocument } from '../model/sankey-document';

interface LayerPlaceholder {
  layer: number;
  value: number;
  height: number;
  order?: number;
  y0?: number;
  y1?: number;
}

function medianBy<T>(arr: T[], fn: (e: T) => number): number {
  const sortedArray = lodashMap(arr, fn).sort((a, b) => a - b);
  const middleIndex = sortedArray.length / 2;
  if (middleIndex % 1 === 0) {
      // Two middle numbers (e.g. [1, 2, 3, 4]), so to get the median take the average of the two
      return sortedArray.slice(
          middleIndex - 1,
          middleIndex + 1 // slice end is exclusive
      ).reduce((a, b) => a + b) / 2;
  } else {
      // middleIndex is "X.5", where the median index of the set is "X"
      return sortedArray[Math.floor(middleIndex)];
  }
}

export const groupByTraceGroupWithAccumulation = (nextNodeCallback) => {
  const traceGroupOrder = new Set();
  return function(links) {
    links.forEach(({trace}) => {
      this.warningController.assert(!isNil(trace), ErrorMessages.missingLinkTrace);
      traceGroupOrder.add(trace.group);
    });
    const groups = [...traceGroupOrder];

    return chain(links)
      .groupBy(link => nextNodeCallback(link)?.id)
      .values()
      .map(nodeLinks => ({
        nodeLinks,
        avgGroup: medianBy(nodeLinks, ({trace}) => groups.indexOf(trace.group))
      }))
      .sortBy('avgGroup')
      .flatMap(({nodeLinks}) => nodeLinks)
      .value();
  };
};

// https://sbrgsoftware.atlassian.net/browse/LL-3732
export const DEFAULT_FONT_SIZE = 12 * 1.60;

export type DefaultLayoutService = LayoutService<TypeContext>;

/**
 * Helper so we can create columns copy with minimum overhead
 */
const copy2DArray = (arr: any[][]) => arr.map(clone);

type NodeColumns<Base extends TypeContext> = (Base['node'] | LayerPlaceholder)[][];

export interface LayersContext<Base extends TypeContext> {
  columns: Base['node'][];
  x: number;
}

interface VirtualNodesContext<Base extends TypeContext> {
  nodesAndPlaceholders: Array<Base['node'] | LayerPlaceholder>;
  columnsWithLinkPlaceholders: Array<Base['node'] | LayerPlaceholder>[];
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
export class LayoutService<Base extends TypeContext> extends SankeyAbstractLayoutService<Base>
  implements ServiceOnInit, OnDestroy {

  constructor(
    readonly baseView: BaseControllerService<Base>,
    protected readonly truncatePipe: TruncatePipe,
    readonly warningController: WarningControllerService,
    protected readonly modalService: NgbModal,
    protected readonly update: EditService
  ) {
    super(truncatePipe);
    this.extent$.subscribe(this.update.viewPort$);
  }

  destroyed$ = new Subject();

  graph$: Observable<Base['data']> = this.baseView.common.view$.pipe(
    // ensure no calculation of view if base view changed
    takeUntil(this.destroyed$),
    // temporary fixes end
    switchMap(view => this.calculateLayout$),
    switchMap((data: any) => this.horizontalStretch$.pipe(
      map(horizontalZoom => {
        data.nodes.forEach(node => {
          node.x0 = horizontalZoom * node.initialX0;
          node.x1 = node.x0 + this.dx;
        });
        return data;
      })
    )),
    debug('graph$'),
    shareReplay<Base['data']>(1),
    takeUntil(this.destroyed$)
  );

  linkPath$ = this.baseView.common.normalizeLinks$.pipe(
    map(normalizeLinks => {
      const {calculateLinkPathParams, composeLinkPath} = this;
      return link => {
        link.calculated_params = calculateLinkPathParams(link, normalizeLinks);
        return composeLinkPath(link.calculated_params);
      };
    })
  );

  fontSize$ = this.baseView.common.fontSizeScale$.pipe(
    map(fontSizeScale =>
      // noinspection JSUnusedLocalSymbols
      (d?, i?, n?) => DEFAULT_FONT_SIZE * fontSizeScale
    )
  );

  horizontalStretch$ = new BehaviorSubject(1);

  state$: Partial<SankeyState>;
  baseState$: Partial<SankeyBaseState>;

  viewPort$ = new ReplaySubject(1);

  extent$: Observable<ProcessedExtent> = this.viewPort$.pipe(
    map(({x0, x1, y0, y1}) => ({
      x0, x1, width: x1 - x0,
      y0, y1, height: y1 - y0
    })),
    switchMap(viewPort =>
      this.baseView.common.view$.pipe(
        map(view =>
          isNil(view) ?
            viewPort :
            assign(
              {},
              viewPort,
              {
                x1: viewPort.x0 + view.size.width,
                y1: viewPort.y0 + view.size.height
              },
              view.size
            )
        )
      )
    ),
    distinctUntilChanged(isEqual),
    debug<ProcessedExtent>('extent$'),
    shareReplay(1)
  );

  horizontal$: Observable<Horizontal> = this.extent$.pipe(
    map(({x0, x1, width}) => ({x0, x1, width})),
    distinctUntilChanged(isEqual),
    debug('horizontal$'),
    shareReplay(1)
  );

  vertical$: Observable<Vertical> = this.extent$.pipe(
    map(({y0, y1, height}) => ({y0, y1, height})),
    distinctUntilChanged(isEqual),
    debug('vertical$'),
    shareReplay(1)
  );

  private calculateLayout$;

  isAutoLayout$ = combineLatest([
    this.update.edited$, this.baseView.common.view$
  ]).pipe(
    map(args => args.every(a => !a)),
    shareReplay({refCount: true, bufferSize: 1})
  );

  setViewPort(viewPort) {
    this.viewPort$.next(viewPort);
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  positionNodes(x) {
    return switchMap(data => this.update.edited$.pipe(
        switchMap(edited =>
          iif(
            () => edited,
            of(data),
            this.horizontal$.pipe(
              first(),
              map(horizontal => {
                // Absolute node positioning
                this.positionNodesHorizontaly(data, horizontal, x);
                return data;
              })
            )
          )
        )
      )
    );
  }

  computeLinkBreadths(nodesAndPlaceholders) {
    return tap(x => {
      for (const node of nodesAndPlaceholders) {
        let y0 = node.y0;
        let y1 = y0;
        for (const link of node.sourceLinks) {
          link.y0 = y0 + link.width / 2;
          if (!isFinite(link.y0)) {
            throw new Error(`link.y0 is not finite: ${link.y0}`);
          }
          // noinspection JSSuspiciousNameCombination
          y0 += link.width;
        }
        for (const link of node.targetLinks) {
          link.y1 = y1 + link.width / 2;
          if (!isFinite(link.y1)) {
            throw new Error(`link.y1 is not finite: ${link.y1}`);
          }
          // noinspection JSSuspiciousNameCombination
          y1 += link.width;
        }
      }
    });
  }

  assignValues(data) {
    return combineLatest([
      this.baseView.nodeValueAccessor$,
      this.baseView.linkValueAccessor$,
      // this.baseView.common.prescaler$
    ]).pipe(
      filter<[ValueGenerator<Base>, ValueGenerator<Base>]>(params => params.every(param => !!param)),
      tap(([nodeValueAccessor, linkValueAccessor]) => {

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
          if (n.value !== undefined) {
            // n.value = prescaler.fn(n.value);
            return Math.min(m, n.value);
          }
          return m;
        }, 0);
        minValue = data.links.reduce((m, l) => {
          // l.value = prescaler.fn(l.value);
          if (l.multipleValues) {
            // l.multipleValues = l.multipleValues.map(prescaler.fn) as [number, number];
            return Math.min(m, ...l.multipleValues);
          }
          return Math.min(m, l.value);
        }, minValue);

        if (nodeValueAccessor.postprocessing) {
          Object.assign(data, nodeValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (linkValueAccessor.postprocessing) {
          Object.assign(data, linkValueAccessor.postprocessing.call(this, data) ?? {});
        }
        if (minValue < 0) {
          data.nodes.forEach(n => {
            if (n.value !== undefined) {
              n.value = n.value - minValue;
            }
          });
          data.links.forEach(l => {
            l.value = l.value - minValue;
            if (l.multipleValues) {
              l.multipleValues = l.multipleValues.map(v => v - minValue) as [number, number];
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
    const virtualPaths = new ExtendedMap<string, ExtendedArray<LayerPlaceholder>>();

    for (const link of data.links) {
      let virtualPathStartLayer;
      let virtualPathEndLayer;
      if (link.circular) {
        virtualPathStartLayer = link.target.layer;
        virtualPathEndLayer = link.source.layer;
      } else {
        // if the link spans more than 1 column, then replace it with virtual nodes and links
        if (link.target.layer - link.source.layer > 1) {
          virtualPathStartLayer = link.source.layer;
          virtualPathEndLayer = link.target.layer;
        } else {
          continue;
        }
      }
      const id = link.source.id + ' ' + link.target.id;
      const virtualPath = virtualPaths.getSet(id, new ExtendedArray());
      range(virtualPathStartLayer, virtualPathEndLayer).forEach(layer =>
        virtualPath.getSetLazily(layer, () => {
          const newNode = {
            value: 0,
            layer
          };
          columnsWithLinkPlaceholders[layer].push(newNode);
          return newNode;
        }).value += link.value
      );
    }

    return {
      nodesAndPlaceholders: flatMap(columnsWithLinkPlaceholders, column => column),
      columnsWithLinkPlaceholders
    } as VirtualNodesContext<Base>;
  }

  /**
   * Same as parent method just ignoring circular links
   */
  computeNodeHeights(nodesAndPlaceholders) {
    return tap(({nodeHeight: {min: {enabled, value}}, ky}) => {
      const {value: valueAccessor} = this;
      for (const node of nodesAndPlaceholders) {
        if (enabled && value) {
          node.height = Math.max(valueAccessor(node) * ky, value);
        } else {
          node.height = valueAccessor(node) * ky;
        }
      }
    });
  }

  computeNodeBreadths(data, columns): OperatorFunction<any, any> {
    throw new Error();
  }

  layoutNodesWithinColumns(columns: Base['node'][][]) {
    return tap(({ky, y0, y1, height}) =>
      columns.forEach(nodes => {
        const {length} = nodes;
        const nodesHeight = sum(nodes, n => n.height);
        // do we want space above and below nodes or should it fill column till the edges?
        const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
        const freeSpace = height - nodesHeight;
        const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
        let y = additionalSpacers ? spacerSize + y0 : y0;
        // nodes are placed in order from tree traversal
        nodes.sort((a, b) => a.order - b.order).forEach(node => {
          const nodeHeight = node.height;
          node.y0 = y;
          if (!isFinite(node.y0)) {
            throw new Error('y0 is not finite');
          }
          node.y1 = y + nodeHeight;
          if (!isFinite(node.y1)) {
            throw new Error('y1 is not finite');
          }
          y += nodeHeight + spacerSize;
          // apply the y scale on links
          // for (const link of node.sourceLinks) {
          //   link.width = link.value * ky;
          //   if (!isFinite(link.width)) {
          //     throw new Error('width is not finite');
          //   }
          // }
        });
      })
    );
  }

  adjustNodesHeight(nodes: Base['node'][]) {
    return tap(() =>
      nodes.forEach(node => {
        node.y1 = node.y0 + node.height;
      })
    );
  }

  sortNodesLinks(nodes) {
    for (const {sourceLinks, targetLinks} of nodes) {
      sourceLinks.sort(this.linkSort);
      targetLinks.sort(this.linkSort);
    }
  }

  computeLinksWidth({links}) {
    return tap(({ky}) => {
      const {value: valueAccessor} = this;
      for (const link of links) {
        link.width = link.value * ky;
        if (!isFinite(link.width)) {
          throw new Error('width is not finite');
        }
      }
    });
  }

  getVerticalLayoutParams$(nodesAndPlaceholders, columnsWithLinkPlaceholders: NodeColumns<Base>) {
    return combineLatest([
      this.baseView.nodeHeight$,
      this.vertical$
    ]).pipe(
      map(([nodeHeight, {height, y0, y1}]) => {
        const {dy, py, dx, value} = this;

        // normal calculation based on tallest column
        let ky = Math.max(0, min(columnsWithLinkPlaceholders, c => (height - (c.length - 1) * py) / sum(c, value)));
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
      }),
      debug('setVerticalLayoutParams')
    );
  }

  computeNodeLayers(data) {
    return this.baseView.common.align$.pipe(
      map(align => {
        const {dx} = this;
        const {nodes} = data as LayoutData;
        const x = max(nodes, d => d.depth) + 1;
        // Don't use Array.fill([]) as it will just copy ref to the same []
        const columns: Base['node'][][] = new Array(x).fill(undefined).map(() => []);
        for (const node of nodes) {
          const i = Math.max(0, Math.min(x - 1, Math.floor(align.fn.call(null, node, x))));
          node.layer = i;
          columns[i].push(node);
        }
        // if (this.nodeSort) {
        //   for (const column of columns) {
        //     column.sort(this.nodeSort);
        //   }
        // }
        return {
          x,
          columns
        };
      })
    );
  }

  loadNodesPositionFromView(verticalContext, data, view: View) {
    return this.horizontal$.pipe(
      first(),
      map(horizontalContext => {
        // Absolute node positioning
        const sy = verticalContext.height / view.size.height;
        const sx = horizontalContext.width / view.size.width;
        // for faster lookup
        const entityById = new Map<string, SankeyNode>(data.nodes.map((d, i) => [String(d.id), d]));
        Object.entries(view.nodes).map(([id, {y0, y1, x0, order}]) => {
          const entity = entityById.get(id);
          if (entity) {
            entity.y0 = y0;
            entity.y1 = y0 + entity.height;
            entity.initialX0 = x0;
            entity.initialX1 = x0 + this.dx;
            entity.order = order;
          } else {
            this.warningController.warn(ErrorMessages.missingEntity(id));
          }
        });
        return verticalContext;
      })
    );
  }

  loadLinkOrderFromView(data, view: View) {
    return tap(() => {
      // for faster lookup
      const entityById = new Map<string, SankeyNode>(data.links.map((d, i) => [String(d.id), d]));
      Object.entries(view.links).map(([id, {order}]) => {
        const entity = entityById.get(id);
        if (entity) {
          entity.order = order;
        } else {
          this.warningController.warn(ErrorMessages.missingEntity(id));
        }
      });
    });
  }

  onInit(): void {
    this.calculateLayout$ = this.baseView.networkTraceData$.pipe(
      tap(() => this.update.reset()),
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
      switchMap((data: SankeyDocument) => this.computeNodeLayers(data).pipe(
        switchMap(({columns, x}) =>
          // Calculate the nodes' values, based on the values of the incoming and outgoing links
          this.assignValues(data).pipe(
            debug('assignValues'),
            switchMap(() => {
              const {nodesAndPlaceholders, columnsWithLinkPlaceholders} = this.createVirtualNodes(data, columns);
              return this.getVerticalLayoutParams$(nodesAndPlaceholders, columnsWithLinkPlaceholders).pipe(
                this.computeNodeHeights(nodesAndPlaceholders),
                debug('computeNodeHeights'),
                takeUntil(this.destroyed$),
                switchMap(verticalContext => combineLatest([
                  this.baseView.common.view$.pipe(first()),
                  this.update.reset$
                ]).pipe(
                  switchMap(([view, reset]) =>
                    iif(
                      () => isNil(view),
                      of(verticalContext).pipe(
                        // Calculate the nodes' and links' vertical position within their respective column
                        //     Also readjusts sankeyCircular size if circular links are needed, and node x's
                        this.computeNodeBreadths(data, columns),
                        tap(() => {
                          if (this.nodeSort) {
                            for (const column of columnsWithLinkPlaceholders) {
                              column.sort(this.nodeSort);
                            }
                          }
                        }),
                        debug('computeNodeBreadths'),
                        catchError(() => EMPTY),
                        switchMap(d =>
                          this.update.edited$.pipe(
                            first(),
                            switchMap(edited =>
                              iif(
                                () => edited,
                                of(d).pipe(
                                  this.adjustNodesHeight(data.nodes)
                                ),
                                of(d).pipe(
                                  this.layoutNodesWithinColumns(columns)
                                )
                              )
                            )
                          )
                        ),
                        debug('layoutNodesWithinColumns')
                      ),
                      of(verticalContext).pipe(
                        switchMap(d =>
                          this.update.edited$.pipe(
                            first(),
                            switchMap(edited =>
                              iif(
                                () => edited,
                                of(d).pipe(
                                  this.adjustNodesHeight(data.nodes)
                                ),
                                this.loadNodesPositionFromView(verticalContext, data, view).pipe(
                                  this.loadLinkOrderFromView(data, view)
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  ),
                  tap(() => this.sortNodesLinks(data.nodes)),
                  this.computeLinksWidth(data),
                  this.computeLinkBreadths(data.nodes),
                  debug('computeLinkBreadths'),
                )),
                switchMap(verticalContext => this.baseView.common.view$.pipe(
                  first(),
                  switchMap(view =>
                    iif(
                      () => isNil(view),
                      of(data).pipe(this.positionNodes(x)),
                      of(data)
                    )
                  )
                )),
                debug('positionNodes')
              );
            })
          ))
      )),
      debug('calculateLayout'),
      // IMPORTANT!
      // If refCount is true, the source will be unsubscribed from once the reference count drops to zero,
      // i.e. the inner ReplaySubject will be unsubscribed. All new subscribers will receive value emissions
      // from a new ReplaySubject which in turn will cause a new subscription to the source observable.
      shareReplay({bufferSize: 1, refCount: true}),
      takeUntil(this.destroyed$)
    );
  }

  calculateSizeFromNodesPosition(nodes) {
    // tslint:disable-next-line:one-variable-per-declaration
    let rx0, rx1, ry0, ry1;
    for (const {x0, x1, y0, y1} of nodes) {
      if (rx0 === undefined || x0 < rx0) {
        rx0 = x0;
      }
      if (rx1 === undefined || x1 > rx1) {
        rx1 = x1;
      }
      if (ry0 === undefined || y0 < ry0) {
        ry0 = y0;
      }
      if (ry1 === undefined || y1 > ry1) {
        ry1 = y1;
      }
    }
    return {
      x0: rx0,
      x1: rx1,
      y0: ry0,
      y1: ry1,
      width: rx1 - rx0,
      height: ry1 - ry0
    };
  }

  calculateLinkPathParams(link, normalize = true) {
    const {source, target, multipleValues} = link;
    let {value: linkValue} = link;
    linkValue = linkValue || 1e-4;
    const sourceX = source.x1;
    const targetX = target.x0;
    const {sourceLinks} = source;
    const {targetLinks} = target;
    const sourceIndex = sourceLinks.indexOf(link);
    const targetIndex = targetLinks.indexOf(link);
    const columns = Math.abs(target.layer - source.layer);
    const linkWidth = Math.abs(targetX - sourceX);
    const bezierOffset = (link.circular ? linkWidth / columns : linkWidth) / 2;
    const sourceBezierX = sourceX + bezierOffset;
    const targetBezierX = targetX - bezierOffset;
    let sourceY0;
    let sourceY1;
    let targetY0;
    let targetY1;
    let sourceY = 0;
    let targetY = 0;

    for (let i = 0; i < sourceIndex; i++) {
      const nestedLink = sourceLinks[i];
      sourceY += nestedLink.multipleValues?.[0] ?? nestedLink.value ?? 0;
    }
    for (let i = 0; i < targetIndex; i++) {
      const nestedLink = targetLinks[i];
      targetY += nestedLink.multipleValues?.[1] ?? nestedLink.value ?? 0;
    }

    if (normalize) {
      let sourceValues;
      let targetValues;
      if (multipleValues) {
        sourceValues = sourceLinks.map(l => l.multipleValues?.[0] ?? l.value);
        targetValues = targetLinks.map(l => l.multipleValues?.[1] ?? l.value);
      } else {
        sourceValues = sourceLinks.map(({value}) => value);
        targetValues = targetLinks.map(({value}) => value);
      }
      const sourceNormalizer = sourceLinks.normalizer ?? (sourceLinks.normalizer = normalizeGenerator(sourceValues));
      const targetNormalizer = targetLinks.normalizer ?? (targetLinks.normalizer = normalizeGenerator(targetValues));
      const sourceHeight = source.y1 - source.y0;
      const targetHeight = target.y1 - target.y0;

      sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + source.y0;
      targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + target.y0;
      if (multipleValues) {
        sourceY1 = (sourceNormalizer.normalize(multipleValues[0]) * sourceHeight) + sourceY0;
        targetY1 = (targetNormalizer.normalize(multipleValues[1]) * targetHeight) + targetY0;
      } else {
        sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
        targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
      }
    } else {
      let {width} = link;
      width = width || 1e-4;
      const valueScaler = width / linkValue;

      sourceY0 = sourceY * valueScaler + source.y0;
      targetY0 = targetY * valueScaler + target.y0;
      if (multipleValues) {
        sourceY1 = multipleValues[0] * valueScaler + sourceY0;
        targetY1 = multipleValues[1] * valueScaler + targetY0;
      } else {
        sourceY1 = linkValue * valueScaler + sourceY0;
        targetY1 = linkValue * valueScaler + targetY0;
      }
    }
    if ([sourceX,
      sourceY0,
      sourceY1,
      targetX,
      targetY0,
      targetY1,
      sourceBezierX,
      targetBezierX].some(isNaN)) {
      console.log(sourceX, sourceY0, sourceY1, targetX, targetY0, targetY1, sourceBezierX, targetBezierX);
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

  nodeSort = (a, b) => {
    return (a.order - b.order);
  }

  linkSort = (a, b) => (
    // sort by order given in tree traversal
    (a.source.order - b.source.order) ||
    (a.target.order - b.target.order) ||
    (a.order - b.order)
  )

  /**
   * Iterate over nodes and recursively reiterate on the ones they are connecting to.
   * @param nodes - set of nodes to start iteration with
   * @param nextNodeProperty - property of link pointing to next node (source, target)
   * @param nextLinksProperty - property of node pointing to next links (sourceLinks, targetLinks)
   */
  getPropagatingNodeIterator = function*(nodes, nextNodeProperty, nextLinksProperty): Generator<[Base['node'], number]> {
    const n = nodes.length;
    let current = new Set<Base['node']>(nodes);
    let next = new Set<Base['node']>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        yield [node, x];
        for (const link of node[nextLinksProperty]) {
          if (!link.circular) {
            next.add(link[nextNodeProperty] as Base['node']);
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
