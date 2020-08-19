import * as d3 from 'd3';
import { GraphView } from '../graph-view';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, NodeRenderStyle, PlacedEdge, PlacedNode } from 'app/graph-viewer/styles/styles';
import { debounceTime, throttleTime } from 'rxjs/operators';
import { asyncScheduler, fromEvent, Subject, Subscription } from 'rxjs';
import { isStopResult } from '../behaviors';

export interface CanvasGraphViewOptions {
  nodeRenderStyle: NodeRenderStyle;
  edgeRenderStyle: EdgeRenderStyle;
  backgroundFill?: string;
}

/**
 * A graph view that uses renders into a <canvas> tag.
 */
export class CanvasGraphView extends GraphView {
  // Options
  // ---------------------------------

  /**
   * Style used to render nodes.
   */
  nodeRenderStyle: NodeRenderStyle;

  /**
   * Style used to render edges.
   */
  edgeRenderStyle: EdgeRenderStyle;

  /**
   * The canvas background, if any.
   */
  backgroundFill: string | undefined = null;

  /**
   * The minimum interval in ms between renders to keep CPU down.
   */
  renderMinimumInterval = 15;

  /**
   * The maximum number of ms to spend drawing per every animation frame.
   */
  animationFrameRenderTimeBudget = 33; // 33 = 30fps

  // Caches
  // ---------------------------------

  /**
   * Keeps a handle on created node renderers to improve performance.
   */
  private placedNodesCache: Map<UniversalGraphNode, PlacedNode> = new Map();

  /**
   * Keeps a handle on created edge renderers to improve performance.
   */
  private placedEdgesCache: Map<UniversalGraphEdge, PlacedEdge> = new Map();

  // States
  // ---------------------------------

  /**
   * The transform represents the current zoom of the graph, which must be
   * taken into consideration whenever mapping between graph coordinates and
   * viewport coordinates.
   */
  protected d3Transform = d3.zoomIdentity;

  /**
   * The current position of the mouse (graph coordinates) if the user is
   * hovering over the canvas.
   */
  hoverPosition: { x: number, y: number } | undefined;

  /**
   * Keeps track of currently where the mouse (or finger) is held down at
   * so we can display an indicator at that position.
   */
  touchPosition: {
    position: { x: number, y: number },
    entity: GraphEntity | undefined,
  } | undefined;

  /**
   * Store the last time {@link zoomToFit} was called in case the canvas is
   * resized partly through a zoom, making the zoom operation almost useless.
   * This seems to happen a lot with Angular.
   */
  protected previousZoomToFitTime = 0;

  /**
   * Used in {@link setSize} when re-applying zoom-to-fit.
   */
  protected previousZoomToFitPadding = 0;

  /**
   * Keeps track of the time since last render to keep the number of
   * render cycles down.
   */
  protected previousRenderQueueCreationTime = 0;

  /**
   * Holds a queue of things to render to allow spreading rendering over several ticks.
   * Cleared when {@link requestRender} is called and re-created in {@link render}.
   */
  private renderQueue: IterableIterator<any>;

  // Events
  // ---------------------------------

  /**
   * Holds the ResizeObserver to detect resizes. Only set if
   * {@link startParentFillResizeListener} is called, but it may be
   * unset if {@link stopParentFillResizeListener} is called.
   */
  protected canvasResizeObserver: any | undefined; // TODO: TS does not have ResizeObserver defs yet

  /**
   * An observable triggered when resizes are detected.
   */
  canvasResizePendingSubject = new Subject<[number, number]>();

  /**
   * Holds subscriptions to remove when this component is removed.
   */
  private trackedSubscriptions: Subscription[] = [];

  /**
   * The subscription that handles the resizes.
   */
  protected canvasResizePendingSubscription: Subscription | undefined;

  // ========================================

  /**
   * Create an instance of this view.
   * @param canvas the backing <canvas> tag
   * @param options for the view
   */
  constructor(public canvas: HTMLCanvasElement, options: CanvasGraphViewOptions) {
    super();
    Object.assign(this, options);

    this.canvas = canvas;
    this.canvas.tabIndex = 0;
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    this.zoom = d3.zoom()
      .on('zoom', this.canvasZoomed.bind(this))
      .on('end', this.canvasZoomEnded.bind(this));

    // We use rxjs to limit the number of mousemove events
    const canvasMouseMoveSubject = new Subject<any>();

    d3.select(this.canvas)
      .on('click', this.canvasClicked.bind(this))
      .on('dblclick', this.canvasDoubleClicked.bind(this))
      .on('mousedown', this.canvasMouseDown.bind(this))
      .on('mousemove', () => {
        canvasMouseMoveSubject.next();
      })
      .on('dragover', () => {
        canvasMouseMoveSubject.next();
      })
      .on('mouseleave', this.canvasMouseLeave.bind(this))
      .on('mouseup', this.canvasMouseUp.bind(this))
      .call(d3.drag()
        .container(this.canvas)
        .subject(this.getEntityAtMouse.bind(this))
        .on('start', this.canvasDragStarted.bind(this))
        .on('drag', this.canvasDragged.bind(this))
        .on('end', this.canvasDragEnded.bind(this)))
      .call(this.zoom)
      .on('dblclick.zoom', null);

    this.trackedSubscriptions.push(
      canvasMouseMoveSubject
        .pipe(throttleTime(this.renderMinimumInterval, asyncScheduler, {
          leading: true,
          trailing: false,
        }))
        .subscribe(this.canvasMouseMoved.bind(this)),
    );

    this.trackedSubscriptions.push(
      fromEvent(this.canvas, 'keyup')
        .subscribe(this.canvasKeyDown.bind(this)),
    );
  }

  destroy() {
    super.destroy();
    this.stopParentFillResizeListener();
    for (const subscription of this.trackedSubscriptions) {
      subscription.unsubscribe();
    }
  }

  startAnimationLoop() {
    // We can't render() every time something changes, because some events
    // happen very frequently when they do happen (i.e. mousemove),
    // so we'll flag a render as needed and render during an animation
    // frame to improve performance
    requestAnimationFrame(this.animationFrameFired.bind(this));
  }

  /**
   * Start a listener that will cause the canvas to fill its parent element
   * whenever the parent resizes. This method can be called more than once
   * and it will not re-subscribe.
   */
  startParentFillResizeListener() {
    if (this.canvasResizePendingSubscription) {
      return;
    }

    // Handle resizing of the canvas, but doing it with a throttled stream
    // so we don't burn extra CPU cycles resizing repeatedly unnecessarily
    this.canvasResizePendingSubscription = this.canvasResizePendingSubject
      .pipe(debounceTime(250, asyncScheduler))
      .subscribe(([width, height]) => {
        this.setSize(width, height);
      });
    const pushResize = () => {
      this.canvasResizePendingSubject.next([
        this.canvas.clientWidth,
        this.canvas.clientHeight,
      ]);
    };
    // @ts-ignore
    this.canvasResizeObserver = new window.ResizeObserver(pushResize);
    // TODO: Can we depend on ResizeObserver yet?
    this.canvasResizeObserver.observe(this.canvas.parentNode);
  }

  /**
   * Stop trying to resize the canvas to fit its parent node.
   */
  stopParentFillResizeListener() {
    if (this.canvasResizePendingSubscription) {
      this.canvasResizePendingSubscription.unsubscribe();
      this.canvasResizePendingSubscription = null;
    }
    if (this.canvasResizeObserver) {
      this.canvasResizeObserver.disconnect();
      this.canvasResizeObserver = null;
    }
  }

  setGraph(graph: UniversalGraph): void {
    super.setGraph(graph);
    this.placedNodesCache.clear();
    this.placedEdgesCache.clear();
  }

  removeNode(node: UniversalGraphNode): { found: boolean; removedEdges: UniversalGraphEdge[] } {
    const result = super.removeNode(node);
    if (result.found) {
      this.placedNodesCache.delete(node);
      for (const edge of result.removedEdges) {
        this.placedEdgesCache.delete(edge);
      }
    }
    return result;
  }

  removeEdge(edge: UniversalGraphEdge): boolean {
    const found = super.removeEdge(edge);
    if (found) {
      this.placedEdgesCache.delete(edge);
    }
    return found;
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setSize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      const centerX = this.transform.invertX(this.canvas.width / 2);
      const centerY = this.transform.invertY(this.canvas.height / 2);
      this.canvas.width = width;
      this.canvas.height = height;
      super.setSize(width, height);
      this.invalidateAll();
      if (window.performance.now() - this.previousZoomToFitTime < 500) {
        this.applyZoomToFit(0, this.previousZoomToFitPadding);
      } else {
        const newCenterX = this.transform.invertX(this.canvas.width / 2);
        const newCenterY = this.transform.invertY(this.canvas.height / 2);
        d3.select(this.canvas).call(
          this.zoom.translateBy,
          newCenterX - centerX,
          newCenterY - centerY,
        );
      }
    }
  }

  get transform() {
    return this.d3Transform;
  }

  get currentHoverPosition(): { x: number, y: number } | undefined {
    return this.hoverPosition;
  }

  placeNode(d: UniversalGraphNode): PlacedNode {
    let placedNode = this.placedNodesCache.get(d);
    if (placedNode) {
      return placedNode;
    } else {
      const ctx = this.canvas.getContext('2d');

      placedNode = this.nodeRenderStyle.placeNode(d, ctx, {
        selected: this.isAnySelected(d),
        highlighted: this.isAnyHighlighted(d),
      });

      this.placedNodesCache.set(d, placedNode);
      return placedNode;
    }
  }

  placeEdge(d: UniversalGraphEdge): PlacedEdge {
    let placedEdge = this.placedEdgesCache.get(d);
    if (placedEdge) {
      return placedEdge;
    } else {
      const ctx = this.canvas.getContext('2d');
      const from = this.expectNodeByHash(d.from);
      const to = this.expectNodeByHash(d.to);
      const placedFrom: PlacedNode = this.placeNode(from);
      const placedTo: PlacedNode = this.placeNode(to);

      placedEdge = this.edgeRenderStyle.placeEdge(d, from, to, placedFrom, placedTo, ctx, {
        selected: this.isAnySelected(d, from, to),
        highlighted: this.isAnyHighlighted(d, from, to),
      });

      this.placedEdgesCache.set(d, placedEdge);

      return placedEdge;
    }
  }

  invalidateAll(): void {
    this.placedNodesCache.clear();
    this.placedEdgesCache.clear();
  }

  invalidateNode(d: UniversalGraphNode): void {
    super.invalidateNode(d);
    this.placedNodesCache.delete(d);
  }

  invalidateEdge(d: UniversalGraphEdge): void {
    super.invalidateEdge(d);
    this.placedEdgesCache.delete(d);
  }

  getEntityAtMouse(): GraphEntity | undefined {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const x = this.transform.invertX(mouseX);
    const y = this.transform.invertY(mouseY);
    return this.getEntityAtPosition(x, y);
  }

  getEntityAtPosition(x: number, y: number): GraphEntity | undefined {
    const node = this.getNodeAtPosition(this.nodes, x, y);
    if (node) {
      return {
        type: GraphEntityType.Node,
        entity: node,
      };
    }
    const edge = this.getEdgeAtPosition(this.edges, x, y);
    if (edge) {
      return {
        type: GraphEntityType.Edge,
        entity: edge,
      };
    }
    return undefined;
  }

  zoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitTime = window.performance.now();
    this.applyZoomToFit(duration, padding);
  }


  private panToNode(node: UniversalGraphNode, duration: number = 1500, padding = 50) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // TODO - do we need this to for nodes that have been resized to have accurate scaling?
    const {minX, minY, maxX, maxY} = this.getNodeBoundingBox(this.nodes, padding);

    let select = d3.select(this.canvas);

    // Calling transition() causes a delay even if duration = 0
    if (duration > 0) {
      select = select.transition().duration(duration);
    }

    select.call(
      this.zoom.transform,
      d3.zoomIdentity
        // move to center of canvas
        .translate(canvasWidth / 2, canvasHeight / 2)
        .scale(2)
        .translate(-node.data.x, -node.data.y),
    );

    this.invalidateAll();
    this.requestRender();
  }


  /**
   * The real zoom-to-fit.
   */
  private applyZoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const {minX, minY, maxX, maxY} = this.getNodeBoundingBox(this.nodes, padding);
    const width = maxX - minX;
    const height = maxY - minY;

    let select = d3.select(this.canvas);

    // Calling transition() causes a delay even if duration = 0
    if (duration > 0) {
      select = select.transition().duration(duration);
    }

    select.call(
      this.zoom.transform,
      d3.zoomIdentity
        .translate(canvasWidth / 2, canvasHeight / 2)
        .scale(Math.min(1, Math.min(canvasWidth / width, canvasHeight / height)))
        .translate(-minX - width / 2, -minY - height / 2),
    );

    this.invalidateAll();
    this.requestRender();
  }

  // ========================================
  // Rendering
  // ========================================

  /**
   * Fired from requestAnimationFrame() and used to render the graph
   * in the background as necessary.
   */
  animationFrameFired() {
    if (!this.active) {
      // Happens when this component is destroyed
      return;
    }

    // Instead of rendering on every animation frame, we keep track of a flag
    // that gets set to true whenever the graph changes and so we need to re-draw it
    if (this.renderingRequested) {
      const now = window.performance.now();

      // But even then, we'll still throttle the number of times we restart rendering
      // in case the flag is set to true too frequently in a period
      if (now - this.previousRenderQueueCreationTime > this.renderMinimumInterval) {
        this.emptyCanvas(); // Clears canvas

        // But we actually won't necessarily render the whole graph at once: we'll
        // build a queue of things to render and render the graph in batches,
        // limiting the amount we render in a batch so we never exceed our
        // expected FPS
        this.renderQueue = this.generateRenderQueue();

        // Reset flags so we don't do this again until a render is requested
        this.renderingRequested = false;
        this.previousRenderQueueCreationTime = now;
      }
    }

    // It looks like we have a list of things we need to render, so let's
    // work through it and draw as much as possible until we hit the 'render time budget'
    if (this.renderQueue) {
      const startTime = window.performance.now();

      // ctx.save(), ctx.translate(), ctx.scale()
      this.startCurrentRenderBatch();

      while (true) {
        const result = this.renderQueue.next();

        if (result.done) {
          // Finished rendering!
          this.renderQueue = null;
          break;
        }

        // Check render time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.animationFrameRenderTimeBudget) {
          break;
        }
      }

      // ctx.restore()
      this.endCurrentRenderBatch();
    }

    // Need to call this every time so we keep running
    requestAnimationFrame(this.animationFrameFired.bind(this));
  }

  render() {
    // Since we're rendering in one shot, clear any queue that we may have started
    this.renderQueue = null;

    // Clears canvas
    this.emptyCanvas();

    // ctx.save(), ctx.translate(), ctx.scale()
    this.startCurrentRenderBatch();

    // Render everything in the queue all at once
    const queue = this.generateRenderQueue();
    while (true) {
      const result = queue.next();
      if (result.done) {
        break;
      }
    }

    // ctx.save()
    this.endCurrentRenderBatch();
  }

  /**
   * Clears the canvas for a brand new render.
   */
  private emptyCanvas() {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');

    if (this.backgroundFill) {
      ctx.fillStyle = this.backgroundFill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Save the context and set the canvas transform. Call this before performing
   * any draw actions during a render batch. Note that a render consists of one or
   * more batches, so call this method for EVERY batch.
   */
  private startCurrentRenderBatch() {
    const ctx = this.canvas.getContext('2d');

    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);
  }

  /**
   * Restore the context. Call this after performing any draw actions
   * during a render. Note that a render consists of one or more batches, so call
   * this method for EVERY batch.
   */
  private endCurrentRenderBatch() {
    const ctx = this.canvas.getContext('2d');

    ctx.restore();

    this.updateMouseCursor();
  }

  /**
   * Builds an iterable that will draw the graph. Before
   * actually iterating through, first call {@link startCurrentRenderBatch} at the
   * start of every rendering batch and then at the end of any batch,
   * call {@link endCurrentRenderBatch}.
   */
  * generateRenderQueue() {
    const ctx = this.canvas.getContext('2d');

    yield* this.drawTouchPosition(ctx);
    yield* this.drawHighlightBackground(ctx);
    yield* this.drawLayoutGroups(ctx);
    yield* this.drawEdges(ctx);
    yield* this.drawNodes(ctx);
    yield* this.drawActiveBehaviors(ctx);
  }

  private* drawTouchPosition(ctx: CanvasRenderingContext2D) {
    yield null;

    if (this.touchPosition) {
      const noZoomScale = 1 / this.transform.scale(1).k;
      const touchPositionEntity = this.touchPosition.entity;

      if (touchPositionEntity != null) {
        ctx.beginPath();
        const bbox = this.getEntityBoundingBox([touchPositionEntity], 10);
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(this.touchPosition.position.x, this.touchPosition.position.y, 20 * noZoomScale, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
        ctx.fill();
      }
    }
  }

  private* drawHighlightBackground(ctx: CanvasRenderingContext2D) {
    yield null;

    if (!this.touchPosition) {
      const highlighted = this.highlighting.get();
      for (const highlightedEntity of highlighted) {
        ctx.beginPath();
        const bbox = this.getEntityBoundingBox([highlightedEntity], 10);
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
        ctx.fill();
      }
    }
  }

  private* drawLayoutGroups(ctx: CanvasRenderingContext2D) {
    yield null;

    // TODO: This is currently only for demo
    for (const d of this.layoutGroups) {
      if (d.leaves.length) {
        ctx.beginPath();
        const bbox = this.getNodeBoundingBox(d.leaves.map(entry => entry.reference), 10);
        ctx.fillStyle = d.color;
        ctx.strokeStyle = d.color;
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    }
  }

  private* drawEdges(ctx: CanvasRenderingContext2D) {
    yield null;

    const transform = this.transform;
    const placeEdge = this.placeEdge.bind(this);

    // We need to turn edges into PlacedEdge objects before we can render them,
    // but the process involves calculating various metrics, which we don't
    // want to do more than once if we need to render in multiple Z-layers (line + text)
    const edgeRenderObjects = [];

    for (const d of this.edges) {
      yield null;
      edgeRenderObjects.push({
        d,
        placedEdge: placeEdge(d),
      });
    }

    for (const {d, placedEdge} of edgeRenderObjects) {
      yield null;
      placedEdge.draw(transform);
    }

    for (const {d, placedEdge} of edgeRenderObjects) {
      yield null;
      placedEdge.drawLayer2(transform);
    }
  }

  private* drawNodes(ctx: CanvasRenderingContext2D) {
    for (const d of this.nodes) {
      yield null;
      ctx.beginPath();
      this.placeNode(d).draw(this.transform);
    }
  }

  private* drawActiveBehaviors(ctx: CanvasRenderingContext2D) {
    for (const behavior of this.behaviors.getBehaviors()) {
      yield null;
      behavior.draw(ctx, this.transform);
    }
  }

  /**
   * Update the current mouse cursor.
   */
  updateMouseCursor() {
    const canvas = this.canvas;
    if (this.dragging.get().length) {
      canvas.style.cursor = 'grabbing';
    } else if (this.panningOrZooming) {
      canvas.style.cursor = 'move';
    } else if (this.highlighting.get().length) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // ========================================
  // Event handlers
  // ========================================

  canvasKeyDown(event) {
    if (isStopResult(this.behaviors.apply(behavior => behavior.keyDown(event)))) {
      event.preventDefault();
    }
  }

  canvasClicked(event) {
    this.behaviors.apply(behavior => behavior.click(d3.event));
  }

  canvasDoubleClicked() {
    this.behaviors.apply(behavior => behavior.doubleClick(d3.event));
  }

  canvasMouseDown() {
    this.mouseDown = true;
  }

  canvasMouseMoved() {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const graphX = this.transform.invertX(mouseX);
    const graphY = this.transform.invertY(mouseY);
    const entityAtMouse = this.getEntityAtPosition(graphX, graphY);

    this.highlighting.replace(entityAtMouse ? [entityAtMouse] : []);
    this.hoverPosition = {x: graphX, y: graphY};

    this.behaviors.apply(behavior => behavior.mouseMove());

    if (this.mouseDown) {
      this.touchPosition = {
        position: {
          x: graphX,
          y: graphY,
        },
        entity: null,
      };

      this.requestRender();
    }

    this.updateMouseCursor();
  }

  canvasMouseLeave() {
    this.hoverPosition = null;
  }

  canvasMouseUp() {
    this.mouseDown = false;
    this.touchPosition = null;
    this.requestRender();
  }

  canvasDragStarted(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const subject: GraphEntity | undefined = d3.event.subject;

    this.behaviors.apply(behavior => behavior.dragStart(d3.event.sourceEvent));

    this.dragging.replace(subject ? [subject] : []);
    this.selection.replace(subject ? [subject] : []);

    this.touchPosition = {
      position: {
        x: this.transform.invertX(mouseX),
        y: this.transform.invertY(mouseY),
      },
      entity: subject,
    };

    this.requestRender();
  }

  canvasDragged(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const subject: GraphEntity | undefined = d3.event.subject;

    this.behaviors.apply(behavior => behavior.drag(d3.event.sourceEvent));

    this.touchPosition = {
      position: {
        x: this.transform.invertX(mouseX),
        y: this.transform.invertY(mouseY),
      },
      entity: subject,
    };

    this.requestRender();
  }

  canvasDragEnded(): void {
    this.behaviors.apply(behavior => behavior.dragEnd(d3.event.sourceEvent));
    this.dragging.replace([]);
    this.nodePositionOverrideMap.clear();
    this.mouseDown = false;
    this.touchPosition = null;
    this.requestRender();
  }

  canvasZoomed(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    this.d3Transform = d3.event.transform;
    this.panningOrZooming = true;
    this.touchPosition = {
      position: {
        x: this.transform.invertX(mouseX),
        y: this.transform.invertY(mouseY),
      },
      entity: null,
    };
    this.requestRender();
  }

  canvasZoomEnded(): void {
    this.panningOrZooming = false;
    this.touchPosition = null;
    this.mouseDown = false;
    this.requestRender();
  }
}
