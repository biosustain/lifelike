import {
  GraphEntity,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphNode
} from 'app/drawing-tool/services/interfaces';
import * as d3 from 'd3';
import * as cola from 'webcola';
import { InputNode, Layout } from 'webcola';
import { Group, Link } from 'webcola/WebCola/src/layout';
import { Subject } from 'rxjs';
import { PlacedEdge, PlacedNode } from './styles/graph-styles';
import { GraphAction, GraphActionReceiver } from './actions/actions';

/**
 * A rendered view of a graph.
 */
export abstract class GraphView implements GraphActionReceiver {
  /**
   * Set to false when the component is destroyed so we can stop rendering.
   */
  protected active = true;

  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of nodes being rendered.
   */
  nodes: UniversalGraphNode[] = [];

  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of edges being rendered.
   */
  edges: UniversalGraphEdge[] = [];

  /**
   * Collection of layout groups on the graph.
   */
  layoutGroups: GraphLayoutGroup[] = [];

  /**
   * Maps node's hashes to nodes for O(1) lookup, essential to the speed
   * of most of this graph code.
   */
  protected nodeHashMap: Map<string, UniversalGraphNode> = new Map();

  /**
   * Keep track of fixed X/Y positions that come from dragging nodes. These
   * values are passed to the automatic layout routines .
   */
  protected nodePositionOverrideMap: Map<UniversalGraphNode, [number, number]> = new Map();

  // Graph states
  // ---------------------------------

  /**
   * Marks that changes to the view were made so we need to re-render.
   */
  protected renderingRequested = false;

  /**
   * Indicates where a mouse button is currently down.
   */
  mouseDown = false;

  /**
   * d3-zoom object used to handle zooming.
   */
  protected zoom: any;

  /**
   * webcola object used for automatic layout.
   * Initialized in {@link ngAfterViewInit}.
   */
  cola: Layout;

  /**
   * Indicates whether we are panning or zooming.
   */
  panningOrZooming = false;

  /**
   * Holds the currently selected node or edge.
   */
  highlighted: GraphEntity | undefined;

  /**
   * Holds the currently highlighted node or edge.
   */
  selected: GraphEntity[];

  /**
   * Holds the currently dragged node or edge.
   */
  dragged: GraphEntity | undefined;

  /**
   * Whether nodes are arranged automatically.
   */
  automaticLayoutEnabled = false;

  // Events
  // ---------------------------------

  /**
   * Stream of selection changes.
   */
  selectionObservable: Subject<GraphEntity[]> = new Subject();

  // History
  // ---------------------------------

  /**
   * Stack of actions in the history.
   */
  history: GraphAction[] = [];

  /**
   * Stores where we are in the history, where the number is the next free index
   * in the history array if there is nothing to redo/rollback. When the user
   * calls undo(), the index goes -1 and when the user calls redo(), the index
   * goes +1.
   */
  protected nextHistoryIndex = 0;

  constructor() {
    this.cola = cola
      .d3adaptor(d3)
      .on('tick', this.colaTicked.bind(this))
      .on('end', this.colaEnded.bind(this));
  }

  /**
   * Start the background loop that updates the animation. If calling
   * this from Angular, use ngZone.runOutsideAngular() to call this method.
   */
  abstract startAnimationLoop();

  /**
   * Remove any hooks that have been created.
   */
  destroy() {
    this.active = false;
  }

  // Data
  // ---------------------------------

  /**
   * Replace the graph that is being rendered by the drawing tool.
   * @param graph the graph to replace with
   */
  setGraph(graph: UniversalGraph): void {
    // TODO: keep or nah?
    this.nodes = [...graph.nodes];
    this.edges = [...graph.edges];

    // We need O(1) lookup of nodes
    this.nodeHashMap = graph.nodes.reduce(
      (map, node) => map.set(node.hash, node),
      new Map()
    );

    this.zoomToFit(0);
    this.requestRender();
  }

  /**
   * Return a copy of the graph.
   */
  getGraph(): UniversalGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void {
    if (this.nodeHashMap.has(node.hash)) {
      throw new Error('trying to add a node that already is in the node list is bad');
    }
    this.nodes.push(node);
    this.nodeHashMap.set(node.hash, node);
    this.requestRender();
  }

  /**
   * Remove the given node from the graph.
   * @param node the node
   * @return true if the node was found
   */
  removeNode(node: UniversalGraphNode): boolean {
    let found = false;

    let i = this.nodes.length;
    while (i--) {
      if (this.nodes[i] === node) {
        this.nodes.splice(i, 1);
        found = true;
      }
    }

    let j = this.edges.length;
    while (j--) {
      if (this.expectNodeByHash(this.edges[j].from) === node
        || this.expectNodeByHash(this.edges[j].to) === node) {
        this.edges.splice(j, 1);
      }
    }

    this.nodeHashMap.delete(node.hash);

    return found;
  }

  // Properties
  // ---------------------------------

  /**
   * Get the width of the view.
   */
  abstract get width();

  /**
   * Get the height of the view.
   */
  abstract get height();

  /**
   * Set the size of the canvas. Call this method if the backing element
   * (i.e. the <canvas> changes size).
   * @param width the new width
   * @param height the new height
   */
  setSize(width: number, height: number) {
    this.requestRender();
  }

  /**
   * Get the current transform object that is based on the current
   * zoom and pan, which can be used to convert between viewport space and
   * graph space.
   */
  abstract get transform();

  /**
   * Get the current position (graph coordinates) where the user is currently
   * hovering over if the user is doing so, otherwise undefined.
   */
  abstract get currentHoverPosition(): {x: number, y: number} | undefined;

  // ========================================
  // Object accessors
  // ========================================

  /**
   * Get the bounding box containing all the given nodes.
   * @param nodes the nodes to check
   * @param padding padding around all the nodes
   */
  getBoundingBox(nodes: UniversalGraphNode[], padding = 0) {
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;

    for (const node of nodes) {
      const nodeBBox = this.placeNode(node).getBoundingBox();

      if (minX === null || minX > nodeBBox.minX + padding) {
        minX = nodeBBox.minX - padding;
      }
      if (minY === null || minY > nodeBBox.minY + padding) {
        minY = nodeBBox.minY - padding;
      }
      if (maxX === null || maxX < nodeBBox.maxX + padding) {
        maxX = nodeBBox.maxX + padding;
      }
      if (maxY === null || maxY < nodeBBox.maxY + padding) {
        maxY = nodeBBox.maxY + padding;
      }
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
    };
  }

  /**
   * Grab the node referenced by the given hash.
   * @param hash the hash
   */
  getNodeByHash(hash: string): UniversalGraphNode | undefined {
    return this.nodeHashMap.get(hash);
  }

  /**
   * Grab the node referenced by the given hash. Throws an error if not found.
   * @param hash the hash
   */
  expectNodeByHash(hash: string): UniversalGraphNode {
    const node = this.getNodeByHash(hash);
    if (node == null) {
      throw new Error('missing node link');
    }
    return node;
  }

  /**
   * Find the best matching node at the given position.
   * @param nodes list of nodes to search through
   * @param x graph X location
   * @param y graph Y location
   */
  getNodeAtPosition(nodes: UniversalGraphNode[], x: number, y: number): UniversalGraphNode | undefined {
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      if (this.placeNode(d).isPointIntersecting(x, y)) {
        return d;
      }
    }
    return undefined;
  }

  /**
   * Find the best matching edge at the given position.
   * @param edges list of edges to search through
   * @param x graph X location
   * @param y graph Y location
   */
  getEdgeAtPosition(edges: UniversalGraphEdge[], x: number, y: number): UniversalGraphEdge | undefined {
    for (const d of edges) {
      const from = this.expectNodeByHash(d.from);
      const to = this.expectNodeByHash(d.to);
      if (this.placeEdge(d, from, to).isPointIntersecting(x, y)) {
        return d;
      }
    }
    return undefined;
  }

  /**
   * Get the graph entity located where the mouse is.
   * @return the entity, or nothing
   */
  abstract getEntityAtMouse(): GraphEntity | undefined;

  // ========================================
  // Rendering
  // ========================================

  /**
   * Request the graph be re-rendered in the very near future.
   */
  requestRender() {
    this.renderingRequested = true;
  }

  /**
   * Re-render the graph and update the mouse cursor.
   */
  abstract render();

  /**
   * Place the given node onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the node. The
   * returned object has the style of the node baked into it.
   * @param d the node
   */
  abstract placeNode(d: UniversalGraphNode): PlacedNode;

  /**
   * Place the given edge onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the node. The
   * returned object has the style of the edge baked into it.
   * @param d the edge
   * @param from the start node
   * @param to the end node
   */
  abstract placeEdge(d: UniversalGraphEdge,
                     from: UniversalGraphNode,
                     to: UniversalGraphNode): PlacedEdge;

  // ========================================
  // View
  // ========================================

  /**
   * Zoom the graph to fit.
   * @param duration the duration of the animation in ms
   * @param padding padding in graph scale to add to the graph
   */
  abstract zoomToFit(duration: number, padding?);

  // ========================================
  // Selections
  // ========================================

  /**
   * Return if any one of the given items has been selected.
   * @param entities a list of entities to check
   */
  isAnySelected(...entities: UniversalGraphEntity[]) {
    if (!this.selected) {
      return false;
    }
    for (const d of entities) {
      for (const selected of this.selected) {
        if (selected.entity === d) {
          return true;
        }
      }
    }
  }

  /**
   * Return if any one of the given items has been highlighted.
   * @param entities a list of entities to check
   */
  isAnyHighlighted(...entities: UniversalGraphEntity[]) {
    if (!this.highlighted) {
      return false;
    }
    for (const d of entities) {
      if (this.highlighted.entity === d) {
        return true;
      }
    }
    return false;
  }

  /**
   * Select an entity.
   * @param entities a list of entities, which could be an empty list
   */
  select(entities: GraphEntity[]) {
    if (entities == null) {
      throw new Error('API use incorrect: pass empty array for no selection');
    }
    this.selected = entities;
    this.selectionObservable.next(entities);
  }

  // ========================================
  // Events
  // ========================================

  /**
   * Called when webcola (used for layout) has ticked.
   */
  private colaTicked(): void {
    this.requestRender();
  }

  /**
   * Called when webcola (used for layout) has stopped. Cola will stop after finishing
   * performing the layout.
   */
  private colaEnded(): void {
    this.automaticLayoutEnabled = false;
  }

  // ========================================
  // History
  // ========================================

  /**
   * Perform an undo, if there is anything to undo.
   * @return true if there was something to undo
   */
  undo(): boolean {
    // Check to see if there is anything to undo
    if (this.nextHistoryIndex > 0) {
      this.nextHistoryIndex--;
      this.history[this.nextHistoryIndex].rollback(this);
      this.requestRender();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Perform a redo, if there is anything to redo.
   * @return true if there was something to redo
   */
  redo(): boolean {
    // Check to see if there is anything to redo
    if (this.nextHistoryIndex < this.history.length) {
      this.history[this.nextHistoryIndex].apply(this);
      this.nextHistoryIndex++;
      this.requestRender();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Execute an action and store the action to the history stack, while also resetting the
   * history pointer.
   * @param action the action to execute
   */
  execute(action: GraphAction): void {
    // We have unsaved changes
    // this.saveState = false;  // TODO: remove this

    // Drop all changes after this one
    this.history = this.history.slice(0, this.nextHistoryIndex);
    this.history.push(action);
    this.nextHistoryIndex++;

    // Apply the change
    action.apply(this);

    this.requestRender();
  }

  // ========================================
  // Layout
  // ========================================

  /**
   * Apply a graph layout algorithm to the nodes.
   */
  startGraphLayout() {
    this.automaticLayoutEnabled = true;

    const nodePositionOverrideMap = this.nodePositionOverrideMap;

    const layoutNodes: GraphLayoutNode[] = this.nodes.map((d, i) => new class implements GraphLayoutNode {
      index: number = i;
      reference: UniversalGraphNode = d;
      vx = 0;
      vy = 0;

      get x() {
        return d.data.x;
      }

      set x(x) {
        d.data.x = x;
      }

      get y() {
        return d.data.y;
      }

      set y(y) {
        d.data.y = y;
      }

      get fixed() {
        return nodePositionOverrideMap.has(this.reference) ? 1 : 0;
      }

      get px() {
        const position = nodePositionOverrideMap.get(this.reference);
        if (position) {
          return position[0];
        } else {
          return null;
        }
      }

      get py() {
        const position = nodePositionOverrideMap.get(this.reference);
        if (position) {
          return position[1];
        } else {
          return null;
        }
      }
    }());

    const layoutNodeHashMap: Map<string, GraphLayoutNode> = layoutNodes.reduce(
      (map, d) => {
        map.set(d.reference.hash, d);
        return map;
      }, new Map());

    const layoutLinks: GraphLayoutLink[] = this.edges.map(d => {
      const source = layoutNodeHashMap.get(this.expectNodeByHash(d.from).hash);
      if (!source) {
        throw new Error('state error - source did not link up');
      }
      const target = layoutNodeHashMap.get(this.expectNodeByHash(d.to).hash);
      if (!target) {
        throw new Error('state error - source did not link up');
      }
      return {
        reference: d,
        source,
        target,
      };
    });

    // TODO: Remove test groups
    const layoutGroups: GraphLayoutGroup[] = [
      {
        name: 'Bands',
        color: '#740CAA',
        leaves: [],
        groups: [],
        padding: 10,
      },
      {
        name: 'Things',
        color: '#0CAA70',
        leaves: [],
        groups: [],
        padding: 10,
      }
    ];

    for (const node of layoutNodes) {
      const n = Math.floor(Math.random() * (layoutGroups.length + 2));
      if (n < layoutGroups.length) {
        layoutGroups[n].leaves.push(node);
      }
    }

    this.layoutGroups = layoutGroups;

    this.cola
      .nodes(layoutNodes)
      .links(layoutLinks)
      .groups(layoutGroups)
      .symmetricDiffLinkLengths(50)
      .handleDisconnected(false)
      .size([this.width, this.height])
      .start(10);
  }

  /**
   * Stop automatic re-arranging of nodes.
   */
  stopGraphLayout() {
    this.cola.stop();
    this.automaticLayoutEnabled = false;
  }
}

/**
 * Represents the object mirroring a {@link UniversalGraphNode} that is
 * passed to the layout algorithm.
 */
interface GraphLayoutNode extends InputNode {
  /**
   * A link to the original node that this object is mirroring.
   */
  reference: UniversalGraphNode;
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

/**
 * Represents the object mirroring a {@link UniversalGraphEdge} that is
 * passed to the layout algorithm.
 */
interface GraphLayoutLink extends Link<GraphLayoutNode> {
  /**
   * A link to the original edge that this object is mirroring.
   */
  reference: UniversalGraphEdge;
  source: GraphLayoutNode;
  target: GraphLayoutNode;
  index?: number;
}

/**
 * Represents a grouping of nodes passed to the layout algorithm.
 */
interface GraphLayoutGroup extends Group {
  name: string;
  color: string;
  leaves?: GraphLayoutNode[];
}
