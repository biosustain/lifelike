import * as d3 from 'd3';
import { GraphView } from './graph-view';
import { GraphEntity, GraphEntityType, UniversalGraph, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PlacedEdge, PlacedNode } from './styles/graph-styles';
import { AnnotationStyle, annotationTypesMap } from 'app/shared/annotation-styles';
import { DEFAULT_NODE_STYLE, IconNodeStyle } from './styles/nodes';
import { DEFAULT_EDGE_STYLE } from './styles/edges';
import { Arrowhead } from './styles/line-terminators';
import { debounceTime } from 'rxjs/operators';
import { asyncScheduler, Subject, Subscription } from 'rxjs';

/**
 * A graph view that uses renders into a <canvas> tag.
 */
export class GraphCanvasView extends GraphView {
  /**
   * Keeps a handle on created node renderers to improve performance.
   */
  private placedNodesCache: Map<UniversalGraphNode, PlacedNode> = new Map();

  /**
   * Keeps a handle on created edge renderers to improve performance.
   */
  private placedEdgesCache: Map<UniversalGraphEdge, PlacedEdge> = new Map();

  /**
   * The canvas background, if any.
   */
  backgroundFill: string | undefined = null;

  /**
   * The transform represents the current zoom of the graph, which must be
   * taken into consideration whenever mapping between graph coordinates and
   * viewport coordinates.
   */
  protected d3Tansform = d3.zoomIdentity;

  /**
   * The current position of the mouse (graph coordinates) if the user is
   * hovering over the canvas.
   */
  hoverPosition: {x: number, y: number} | undefined;

  /**
   * Keeps track of currently where the mouse (or finger) is held down at
   * so we can display an indicator at that position.
   */
  touchPosition: {
    position: {x: number, y: number},
    entity: GraphEntity | undefined,
  } | undefined;

  /**
   * Used for the double-click-to-create-an-edge function to store the from
   * node and other details regarding the connection.
   */
  protected interactiveEdgeCreationState: EdgeCreationState | undefined = null;

  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  protected offsetBetweenNodeAndMouseInitialPosition: number[] = [0, 0];

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
   * The subscription that handles the resizes.
   */
  protected canvasResizePendingSubscription: Subscription | undefined;

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

  protected previousMouseMoveTime = 0;

  /**
   * Create an instance of this view.
   * @param canvas the backing <canvas> tag
   */
  constructor(public canvas: HTMLCanvasElement) {
    super();

    this.canvas = canvas;
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    this.zoom = d3.zoom()
      .on('zoom', this.canvasZoomed.bind(this))
      .on('end', this.canvasZoomEnded.bind(this));

    d3.select(this.canvas)
      .on('click', this.canvasClicked.bind(this))
      .on('dblclick', this.canvasDoubleClicked.bind(this))
      .on('mousedown', this.canvasMouseDown.bind(this))
      .on('mousemove', this.canvasMouseMoved.bind(this))
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
  }

  destroy() {
    super.destroy();
    this.stopParentFillResizeListener();
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

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setSize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      super.setSize(width, height);
      this.invalidateAll();
      if (window.performance.now() - this.previousZoomToFitTime < 500) {
        this.applyZoomToFit(0, this.previousZoomToFitPadding);
      }
    }
  }

  get transform() {
    return this.d3Tansform;
  }

  get currentHoverPosition(): {x: number, y: number} | undefined {
    return this.hoverPosition;
  }

  placeNode(d: UniversalGraphNode): PlacedNode {
    let placedNode = this.placedNodesCache.get(d);
    if (placedNode) {
      return placedNode;
    } else {
      const ctx = this.canvas.getContext('2d');

      // TODO: Return different styles
      let rendererStyle = DEFAULT_NODE_STYLE;

      // TODO: Cache this stuff
      const annotationStyle: AnnotationStyle = annotationTypesMap.get(d.label);
      if (annotationStyle) {
        if (annotationStyle.iconCode) {
          rendererStyle = new IconNodeStyle(annotationStyle.iconCode);
        }
      }

      if (d.icon) {
        rendererStyle = new IconNodeStyle(d.icon.code, d.icon.face, d.icon.size, d.icon.color);
      }

      placedNode = rendererStyle.place(d, ctx, this.transform, {
        selected: this.isAnySelected(d),
        highlighted: this.isAnyHighlighted(d),
      });

      this.placedNodesCache.set(d, placedNode);

      return placedNode;
    }
  }

  placeEdge(d: UniversalGraphEdge,
            from: UniversalGraphNode,
            to: UniversalGraphNode): PlacedEdge {
    let placedEdge = this.placedEdgesCache.get(d);
    if (placedEdge) {
      return placedEdge;
    } else {
      const ctx = this.canvas.getContext('2d');

      const placedFrom: PlacedNode = this.placeNode(from);
      const placedTo: PlacedNode = this.placeNode(to);

      // TODO: Return different styles
      placedEdge = DEFAULT_EDGE_STYLE.place(d, from, to, placedFrom, placedTo, ctx, this.transform, {
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
    const node = this.getNodeAtPosition(this.nodes, x, y);
    if (node) {
      return {
        type: GraphEntityType.Node,
        entity: node
      };
    }
    const edge = this.getEdgeAtPosition(this.edges, x, y);
    if (edge) {
      return {
        type: GraphEntityType.Edge,
        entity: edge
      };
    }
    return undefined;
  }

  zoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitTime = window.performance.now();
    this.applyZoomToFit(duration, padding);
  }

  /**
   * The real zoom-to-fit.
   */
  private applyZoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const {minX, minY, maxX, maxY} = this.getBoundingBox(this.nodes, padding);
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
          .translate(-minX - width / 2, -minY - height / 2)
      );

    this.invalidateAll();
    this.requestRender();
  }

  /**
   * Fired from requestAnimationFrame(), Used to render the graph.
   */
  animationFrameFired() {
    if (!this.active) {
      // Happens when this component is destroyed
      return;
    }

    if (this.renderingRequested) {
      this.render();

      // No point rendering every frame unless there are changes
      this.renderingRequested = false;
    }

    requestAnimationFrame(this.animationFrameFired.bind(this));
  }

  render() {
    const transform = this.transform;
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');

    // Multiply any values by this number to have it *NOT* scale with zoom
    const noZoomScale = 1 / transform.scale(1).k;

    ctx.save();
    if (this.backgroundFill) {
      ctx.fillStyle = this.backgroundFill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw touch or mouse click position
    // ---------------------------------

    if (this.touchPosition) {
      const touchPositionEntity = this.touchPosition.entity;

      if (touchPositionEntity != null && touchPositionEntity.type === GraphEntityType.Node) {
        ctx.beginPath();
        const bbox = this.getBoundingBox([touchPositionEntity.entity as UniversalGraphNode], 10);
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

    // Draw a background behind highlighted entity
    // ---------------------------------

    if (this.highlighted && !this.touchPosition) {
      if (this.highlighted.type === GraphEntityType.Node) {
        ctx.beginPath();
        const bbox = this.getBoundingBox([this.highlighted.entity as UniversalGraphNode], 10);
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
        ctx.fill();
      }
    }

    // Draw the groups
    // ---------------------------------

    // TODO: This is currently only for demo
    this.layoutGroups.forEach((d, i) => {
      ctx.beginPath();
      if (d.leaves.length) {
        const bbox = this.getBoundingBox(d.leaves.map(entry => entry.reference), 10);
        ctx.fillStyle = d.color;
        ctx.strokeStyle = d.color;
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    });

    // Draw the interactive edge creation feature
    // ---------------------------------

    if (this.interactiveEdgeCreationState && this.interactiveEdgeCreationState.to) {
      ctx.beginPath();

      const {from, to} = this.interactiveEdgeCreationState;
      const color = '#2B7CE9';
      const lineWidth = noZoomScale;

      // Draw arrow
      const arrow = new Arrowhead(16, {
        fillStyle: color,
        strokeStyle: null,
        lineWidth,
      });
      const drawnTerminator = arrow.draw(ctx, from.data.x, from.data.y, to.data.x, to.data.y);

      // Draw line
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.moveTo(from.data.x, from.data.y);
      ctx.lineTo(drawnTerminator.startX, drawnTerminator.startY);
      ctx.stroke();

      // Draw the 'o' node at the end of the line
      const nodeRadius = 6 * noZoomScale;
      const x = to.data.x;
      const y = to.data.y;
      ctx.moveTo(x, y);
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#2B7CE9';
      ctx.stroke();
      ctx.fillStyle = '#97C2FC';
      ctx.fill();
    }

    // Draw edges
    // ---------------------------------

    // We need to turn edges into PlacedEdge objects before we can render them,
    // but the process involves calculating various metrics, which we don't
    // want to do more than once if we need to render in multiple Z-layers (line + text)
    const edgeRenderObjects = this.edges.map(d => ({
      d,
      placedEdge: this.placeEdge(d, this.expectNodeByHash(d.from), this.expectNodeByHash(d.to)),
    }));

    // Draw layer 1 (usually the line)
    edgeRenderObjects.forEach(({d, placedEdge}) => {
      ctx.beginPath();
      placedEdge.render();
    });

    // Draw layer 2 (usually text)
    edgeRenderObjects.forEach(({d, placedEdge}) => {
      ctx.beginPath();
      placedEdge.renderLayer2();
    });

    // Draw nodes
    // ---------------------------------

    this.nodes.forEach((d, i) => {
      ctx.beginPath();
      this.placeNode(d).render();
    });

    ctx.restore();

    // Cursor management
    // ---------------------------------

    this.updateMouseCursor();
  }

  /**
   * Update the current mouse cursor.
   */
  updateMouseCursor() {
    const canvas = this.canvas;
    if (this.dragged) {
      canvas.style.cursor = 'grabbing';
    } else if (this.panningOrZooming) {
      canvas.style.cursor = 'move';
    } else if (this.highlighted) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // ========================================
  // Event handlers
  // ========================================

  canvasClicked() {
    const subject = this.getEntityAtMouse();
    if (this.interactiveEdgeCreationState) {
      if (subject && subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        if (node !== this.interactiveEdgeCreationState.from) {
          const label = prompt('Label please', '') || ''; // Doesn't work for 0
          this.edges.push({
            data: {},
            from: this.interactiveEdgeCreationState.from.hash,
            to: node.hash,
            label,
          });
          this.interactiveEdgeCreationState = null;
        }
      } else {
        this.interactiveEdgeCreationState = null;
      }
    } else {
      this.select(subject ? [subject] : []);
    }
    this.requestRender();
  }

  canvasDoubleClicked() {
    if (!this.interactiveEdgeCreationState) {
      const subject = this.getEntityAtMouse();
      if (subject && subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        this.interactiveEdgeCreationState = {
          from: node,
          to: null,
        };
      }
    }
  }

  canvasMouseDown() {
    this.mouseDown = true;
  }

  canvasMouseMoved() {
    const now = window.performance.now();
    if (now - this.previousMouseMoveTime < 10) {
      return;
    }
    this.previousMouseMoveTime = now;

    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const graphX = this.transform.invertX(mouseX);
    const graphY = this.transform.invertY(mouseY);

    this.highlighted = this.getEntityAtMouse();
    this.hoverPosition = {x: graphX, y: graphY};

    if (this.interactiveEdgeCreationState) {
      this.interactiveEdgeCreationState.to = {
        data: {
          x: graphX,
          y: graphY,
        },
      };

      this.requestRender();
    }

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

    if (subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;

      // We need to store the offset between the mouse and the node, because when
      // we actually move the node, we need to move it relative to this offset
      this.offsetBetweenNodeAndMouseInitialPosition = [
        node.data.x - this.transform.invertX(mouseX),
        node.data.y - this.transform.invertY(mouseY),
      ];
    }

    this.dragged = subject;
    this.select(subject ? [subject] : []);

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

    if (!this.interactiveEdgeCreationState) {
      if (subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        node.data.x = this.transform.invertX(mouseX) + this.offsetBetweenNodeAndMouseInitialPosition[0];
        node.data.y = this.transform.invertY(mouseY) + this.offsetBetweenNodeAndMouseInitialPosition[1];
        this.nodePositionOverrideMap.set(node, [node.data.x, node.data.y]);
        this.invalidateNode(node);
        // TODO: Store this in history as ONE object
      }
    }

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
    this.dragged = null;
    this.nodePositionOverrideMap.clear();
    this.mouseDown = false;
    this.touchPosition = null;
    this.requestRender();
  }

  canvasZoomed(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    this.d3Tansform = d3.event.transform;
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

/**
 * Used to temporarily keep track of the information we need to
 * interactively create an edge.
 */
interface EdgeCreationState {
  from: UniversalGraphNode;
  to?: {
    data: {
      x, y
    }
  };
}
