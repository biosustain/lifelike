import * as d3 from 'd3';
import { Subject } from 'rxjs';
import * as cola from 'webcola';
import { InputNode, Layout } from 'webcola';
import { Link } from 'webcola/WebCola/src/layout';

import {
  GraphEntity,
  GraphEntityType,
  Hyperlink,
  UniversalGraphGroup,
  Source,
  KnowledgeMapGraph,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { compileFind, FindOptions } from 'app/shared/utils/find';
import { ASSOCIATED_MAPS_REGEX } from 'app/shared/constants';
import { setDifference } from 'app/shared/utils';

import { PlacedEdge, PlacedGroup, PlacedNode, PlacedObject } from '../styles/styles';
import { GraphAction, GraphActionReceiver } from '../actions/actions';
import { Behavior, BehaviorList } from './behaviors';
import { CacheGuardedEntityList } from '../utils/cache-guarded-entity-list';
import { RenderTree } from './render-tree';
import { BoundingBox, isPointIntersecting, Point } from '../utils/canvas/shared';

/**
 * A rendered view of a graph.
 */
export abstract class GraphView<BT extends Behavior> implements GraphActionReceiver {
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
  groups: UniversalGraphGroup[] = [];

  /**
   * Maps node's hashes to nodes for O(1) lookup, essential to the speed
   * of most of this graph code.
   */
  protected nodeHashMap: Map<string, UniversalGraphNode> = new Map();

  /**
   * Maps node's hashes to nodes for O(1) lookup, essential to the speed
   * of most of this graph code.
   */
  protected groupHashMap: Map<string, UniversalGraphGroup> = new Map();

  /**
   * Keep track of fixed X/Y positions that come from dragging nodes. These
   * values are passed to the automatic layout routines .
   */
  readonly nodePositionOverrideMap: Map<UniversalGraphNode, [number, number]> = new Map();

  /**
   * Stores the counters for linked documents
   */
  linkedDocuments: Set<string> = new Set();

  // Graph states
  // ---------------------------------

  /**
   * Marks that changes to the view were made so we need to re-render.
   */
  protected renderingRequested = false;

  abstract renderTree: RenderTree;

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
    // TODO: Inspect that. Is this deprecated?
  cola: Layout;

  /**
   * Indicates whether we are panning or zooming.
   */
  panningOrZooming = false;

  /**
   * Holds the currently highlighted node or edge.
   */
  readonly highlighting = new CacheGuardedEntityList(this);

  /**
   * Holds the currently selected node or edge.
   */
  readonly selection = new CacheGuardedEntityList(this);

  /**
   * Holds the currently dragged node or edge.
   */
  readonly dragging = new CacheGuardedEntityList(this);

  /**
   * Holds the nodes and edges for search highlighting
   */
  readonly searchHighlighting = new CacheGuardedEntityList(this);
  readonly searchFocus = new CacheGuardedEntityList(this);

  /**
   * Whether nodes are arranged automatically.
   */
  automaticLayoutEnabled = false;

  /**
   * Holds currently active behaviors. Behaviors provide UI for the graph.
   */
  readonly behaviors = new BehaviorList<BT>([
    'isPointIntersectingNodeHandles',
    'isPointIntersectingEdge',
    'isBBoxEnclosingNode',
    'isBBoxEnclosingEdge',
    'shouldDrag',
  ]);

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

  /**
   * Stream of events when history changes in any way.
   */
  historyChanges$ = new Subject<any>();

  /**
   * Stream of events when a graph entity needs to be focused.
   */
  editorPanelFocus$ = new Subject<any>();

  /**
   * Defines how close to the node we have to click to terminate the node search early.
   */
  readonly MIN_NODE_DISTANCE = 6.0;

  /**
   * Stores hashes of the images that were present when a map was created/saved. Used to keep track of
   * image status on the server in order to send only new images
   * @private
   */
  private savedImageHashes: Set<string>;


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
    this.behaviors.destroy();
  }

  // ========================================
  // Graph
  // ========================================

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
   * Iterate through the link nodes of the GraphEntity and return hashes to linked documents/ET
   * @params links: list to check
   * @returns: list of hashes found in the links
   */
  getLinkedHashes(links: (Source | Hyperlink)[]): string[] {
    // Filter in links that point to desired files
    return links.filter((source) => {
      return ASSOCIATED_MAPS_REGEX.test(source.url);
    // Return hashId of those files (last element of the url address)
    }).map(source => {
      return ASSOCIATED_MAPS_REGEX.exec(source.url)[1];
    });
  }

  /**
   * Check the Entity for links to internal files
   * @param entity: UniversalGraphEntity that we are checking
   */
  checkEntityForLinked(entity: UniversalGraphEntity): Set<string> {
    // NOTE: Should I check only sources?
    if (entity.data) {
      const linkedInHyperlinks = entity.data.hyperlinks ? this.getLinkedHashes(entity.data.hyperlinks) : [];
      const linkedInSources = entity.data.sources ? this.getLinkedHashes(entity.data.sources) : [];
      return new Set(linkedInHyperlinks.concat(linkedInSources));
    }
    return new Set();
  }

  /**
   * Check the entire graph for any linked documents/enrichment tables and return a set of their hashes
   */
  getHashesOfLinked(): Set<string> {
    const set = new Set<string>();
    // Note: Should I check only nodes?
    this.nodes.forEach(node => this.checkEntityForLinked(node).forEach(val => set.add(val)));
    this.edges.forEach(edge => this.checkEntityForLinked(edge).forEach(val => set.add(val)));
    return set;
  }

  /**
   * Save current state of the images after load/save
   */
  saveImagesState() {
    this.savedImageHashes = this.getCurrentImageSet();
  }

  /**
   * Inspect current graph status and extract hashes of the images
   */
  getCurrentImageSet(): Set<string> {
    return new Set(
      this.nodes.flatMap(node => node.image_id !== undefined ? [node.image_id] : [])
    );
  }

  /**
   * Get blobs of new images and hashes of deleted images that will be sent to the server
   */
  getImageChanges() {
    const current = this.getCurrentImageSet();
    const deletedImages = setDifference(this.savedImageHashes, current);
    const newImageHashes = setDifference(current, this.savedImageHashes);
    return {newImageHashes, deletedImages};
  }

  /**
   * Replace the graph that is being rendered by the drawing tool.
   * @param graph the graph to replace with
   */
  // NOTE: This is actually called twice when opening a map in read-only mode - why?
  setGraph(graph: KnowledgeMapGraph): void {
    this.nodes = [...graph.nodes];
    this.edges = [...graph.edges];
    this.groups = [...graph.groups];

    this.saveImagesState();

    // We need O(1) lookup of nodes
    this.nodeHashMap = graph.nodes.reduce(
      (map, node) => map.set(node.hash, node),
      new Map(),
    );

    this.groupHashMap = graph.groups.reduce(
      (map, group) => {
        group.members.forEach((member) => {
          map.set(member.hash, group);
        });
        return map;
      },
      new Map(),
    );

    this.nodePositionOverrideMap.clear();

    this.requestRender();
  }

  /**
   * Return a copy of the graph.
   */
  getGraph(): KnowledgeMapGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
      groups: this.groups,
    };
  }

  /**
   * Return a copy of the graph that is suited to the export. Filters out the nodes with group out of the
   * export map, since they are passed in group.members list - no need to duplicate.
   */
  getExportableGraph(): KnowledgeMapGraph {
    return {
      nodes: this.nodes.filter(node => !this.groupHashMap.has(node.hash)),
      edges: this.edges,
      groups: this.groups
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
  removeNode(node: UniversalGraphNode): {
    found: boolean,
    removedEdges: UniversalGraphEdge[],
  } {
    const removedEdges = [];
    let foundNode = false;

    let i = this.nodes.length;
    while (i--) {
      if (this.nodes[i] === node) {
        this.nodes.splice(i, 1);
        foundNode = true;
        break;
      }
    }
    // Terminate early
    if (!foundNode) {
      return {
        found: false,
        removedEdges: [],
      };
    }

    let j = this.edges.length;
    while (j--) {
      const edge = this.edges[j];
      if (this.expectNodeByHash(edge.from) === node
        || this.expectNodeByHash(edge.to) === node) {
        removedEdges.push(edge);
        this.edges.splice(j, 1);
      }
    }

    this.nodeHashMap.delete(node.hash);
    this.tryRemoveNodeFromGroup(node.hash);
    this.invalidateNode(node);

    // TODO: Only adjust selection if needed
    this.selection.replace([]);
    this.dragging.replace([]);
    this.highlighting.replace([]);
    this.requestRender();

    return {
      found: foundNode,
      removedEdges,
    };
  }

  /**
   * Mark the node as being updated.
   * @param node the node
   */
  updateNode(node: UniversalGraphNode): void {
    this.invalidateNode(node);
    if (this.groupHashMap.has(node.hash)) {
      this.updateGroup(this.groupHashMap.get(node.hash));
    }
  }

  /**
   * Add the given edge to the graph.
   * @param edge the edge
   */
  addEdge(edge: UniversalGraphEdge): void {
    const from = this.expectNodeByHash(edge.from);
    const to = this.expectNodeByHash(edge.to);
    this.edges.push(edge);
    this.invalidateNode(from);
    this.invalidateNode(to);
  }

  /**
   * Remove the given edge from the graph.
   * @param edge the edge
   * @return true if the edge was found
   */
  removeEdge(edge: UniversalGraphEdge): boolean {
    let foundNode = false;
    const from = this.expectNodeByHash(edge.from);
    const to = this.expectNodeByHash(edge.to);

    let j = this.edges.length;
    while (j--) {
      if (this.edges[j] === edge) {
        this.edges.splice(j, 1);
        foundNode = true;
        break;
      }
    }

    this.invalidateNode(from);
    this.invalidateNode(to);

    // TODO: Only adjust selection if needed
    this.selection.replace([]);
    this.dragging.replace([]);
    this.highlighting.replace([]);

    this.requestRender();

    return foundNode;
  }

  /**
   * Mark the edge as being updated.
   * @param edge the node
   */
  updateEdge(edge: UniversalGraphEdge): void {
    this.invalidateEdge(edge);
    this.requestRender();
  }

  /**
   * Create group of nodes
   * @param group - data of the group
   */
  addGroup(group: UniversalGraphGroup) {
    group.members.forEach((member) => {
      this.tryRemoveNodeFromGroup(member.hash);
      this.groupHashMap.set(member.hash, group);
    });
    this.groups.push(this.recalculateGroup(group));
  }

  /**
   * As groups don't have their size, we need to recalculate them when members change position
   * @param group to recalculate
   */
  recalculateGroup(group: UniversalGraphGroup): UniversalGraphGroup {
    const bbox = this.getNodeBoundingBox(group.members || [], group.margin);
    const { minX, minY, maxX, maxY } = bbox;
    const width = Math.abs(maxX - minX);
    const height = Math.abs(maxY - minY);
    group.data.x = maxX - width / 2.0;
    group.data.y = maxY - height / 2.0;
    group.data.width = width;
    group.data.height = height;
    return group;
  }

  /**
   * Remove node from the group - if node has a group.
   * @param hash - hash of node to be removed
   */
  tryRemoveNodeFromGroup(hash: string) {
    const group = this.groupHashMap.get(hash);

    if (group) {
      this.groupHashMap.delete(hash);
      group.members = group.members.filter(node => node.hash !== hash);
      if (group.members.length > 1) {
        this.updateGroup(group);
      } else {
        this.removeGroup(group);
      }
    }
  }

  /**
   * Ungroup nodes
   * @param group - group to be removed
   */
  removeGroup(group: UniversalGraphGroup): boolean {
    let foundNode = false;

    for (let i = 0; i < this.groups.length; i++) {
      const g = this.groups[i];
      if (group.hash === g.hash) {
        this.groups.splice(i, 1);
        foundNode = true;
        break;
      }
    }

    group.members.forEach(node => this.groupHashMap.delete(node.hash));
    this.invalidateGroup(group);

    // TODO: Only adjust selection if needed
    this.selection.replace([]);
    this.dragging.replace([]);
    this.highlighting.replace([]);

    this.requestRender();

    return foundNode;
  }

  updateGroup(group: UniversalGraphGroup) {
    this.recalculateGroup(group);

    this.invalidateGroup(group);
    this.requestRender();
  }

  /**
   * Append new members to a group.
   * @param newMembers New nodes to be added
   * @param group Group to extend
   */
  addToGroup(newMembers: UniversalGraphNode[], group: UniversalGraphGroup) {
    for (const node of newMembers) {
      this.tryRemoveNodeFromGroup(node.hash);
      group.members.push(node);
      this.groupHashMap.set(node.hash, group);
    }
    this.updateGroup(group);
  }


  /**
   * Reverse the actions of addToGroup. No need to update the group, TryRemove does that
   * @param newMembers nodes to delete
   * @param group group to delete from
   */
  removeFromGroup(newMembers: UniversalGraphNode[], group: UniversalGraphGroup) {
    for (const node of newMembers) {
      this.tryRemoveNodeFromGroup(node.hash);
    }
  }

  /**
   * Invalidate the whole renderer cache.
   */
  abstract invalidateAll(): void;

  /**
   * Invalidate any cache entries for the given node. If changes are made
   * that might affect how the node is rendered, this method must be called.
   * @param d the node
   */
  abstract invalidateNode(d: UniversalGraphNode): void;

    /**
     * Invalidate any cache entries for the given edge. If changes are made
     * that might affect how the edge is rendered, this method must be called.
     * @param d the edge
     */
  abstract invalidateEdge(d: UniversalGraphEdge): void;

  abstract invalidateGroup(d: UniversalGraphGroup): void;

  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options aditional find options
   */
  abstract findMatching(terms: string[], options: FindOptions): GraphEntity[];

  /**
   * Get the current position (graph coordinates) where the user is currently
   * hovering over if the user is doing so, otherwise undefined.
   */
  abstract get currentHoverPosition(): { x: number, y: number } | undefined;

  // ========================================
  // Object accessors
  // ========================================

  /**
   * Get the bounding box containing all the given entities.
   * @param entities the entities to check
   * @param padding padding around all the entities
   */
  getEntityBoundingBox(entities: GraphEntity[], padding = 0) {
    return this.getGroupBoundingBox(entities.map(entity => this.placeEntity(entity).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given nodes.
   * @param nodes the nodes to check
   * @param padding padding around all the nodes
   */
  getNodeBoundingBox(nodes: UniversalGraphNode[], padding = 0) {
    return this.getGroupBoundingBox(nodes.map(node => this.placeNode(node).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given edges.
   * @param edges the edges to check
   * @param padding padding around all the edges
   */
  getEdgeBoundingBox(edges: UniversalGraphEdge[], padding = 0) {
    return this.getGroupBoundingBox(edges.map(edge => this.placeEdge(edge).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given bounding boxes.
   * @param boundingBoxes bounding boxes to check
   * @param padding padding around all the bounding boxes
   */
  getGroupBoundingBox(boundingBoxes: BoundingBox[],
                      padding = 0) {
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;

    for (const bbox of boundingBoxes) {
      if (minX === null || minX > bbox.minX) {
        minX = bbox.minX;
      }
      if (minY === null || minY > bbox.minY) {
        minY = bbox.minY;
      }
      if (maxX === null || maxX < bbox.maxX) {
        maxX = bbox.maxX;
      }
      if (maxY === null || maxY < bbox.maxY) {
        maxY = bbox.maxY;
      }
    }

    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
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
   * @param position - {x, y} of the position
   */
  getNodeAtPosition(nodes: UniversalGraphNode[], position: Point): UniversalGraphNode | undefined {
    const possibleNodes = [];
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      const placedNode = this.placeNode(d);
      const hookResult = this.behaviors.call('isPointIntersectingNodeHandles', placedNode, position);
      if ((hookResult !== undefined && hookResult) || placedNode.isPointIntersecting(position)) {
        const distance = Math.hypot(position.x - d.data.x, position.y - d.data.y);
        // Node is so close, that we are sure it is it. Terminate early.
        if (distance <= this.MIN_NODE_DISTANCE) {
          return d;
        }
        possibleNodes.push({
          node: d,
          distance
        });

      }
    }
    if (possibleNodes.length === 0) {
      return undefined;
    }
    possibleNodes.sort((a, b) => {
      return a.distance - b.distance;
    });
    return possibleNodes[0].node;
  }

  /**
   * Find the best matching edge at the given position.
   * @param edges list of edges to search through
   * @param position - {x, y} coordinated of the position
   */
  getEdgeAtPosition(edges: UniversalGraphEdge[], position: Point): UniversalGraphEdge | undefined {
    let bestCandidate: { edge: UniversalGraphEdge, distanceUnsq: number } = null;
    const distanceUnsqThreshold = 5 * 5;

    for (const d of edges) {
      const placedEdge = this.placeEdge(d);

      const hookResult = this.behaviors.call('isPointIntersectingEdge', placedEdge, position);
      if ((hookResult !== undefined && hookResult) || placedEdge.isPointIntersecting(position)) {
        return d;
      }

      const distanceUnsq = placedEdge.getPointDistanceUnsq(position);
      if (distanceUnsq <= distanceUnsqThreshold) {
        if (bestCandidate == null || bestCandidate.distanceUnsq >= distanceUnsq) {
          bestCandidate = {
            edge: d,
            distanceUnsq,
          };
        }
      }
    }

    if (bestCandidate != null) {
      return bestCandidate.edge;
    }

    return undefined;
  }

  /**
   * Find whether there exist a group at position. If 2+ groups share the position, will return newer (top one)
   * @param groups list of groups to search through
   * @param position - {x, y} coordinated of the position
   */
  getGroupAtPosition(groups: UniversalGraphGroup[], position: Point): UniversalGraphGroup | undefined {
    for (const group of groups) {
      const placedGroup = this.placeGroup(group);
      const bbox = placedGroup.getBoundingBox();
      // This hook checks whether rescaling handles are created, and if so, if 'position' is within it.
      const hookResult = this.behaviors.call('isPointIntersectingNodeHandles', placedGroup, position);
      if ((hookResult !== undefined && hookResult) || isPointIntersecting(bbox, position)) {
        return group;
      }
    }
    return null;
  }

  /**
   * Find all the nodes fully enclosed by the bounding box.
   * @param nodes list of nodes to search through
   * @param bbox bounding box to check
   */
  getNodesWithinBBox(nodes: UniversalGraphNode[], bbox: BoundingBox): UniversalGraphNode[] {
    const results = [];
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      const placedNode = this.placeNode(d);
      const hookResult = this.behaviors.call('isBBoxEnclosingNode', placedNode, bbox);
      if ((hookResult !== undefined && hookResult) || placedNode.isBBoxEnclosing(bbox)) {
        results.push(d);
      }
    }
    return results;
  }

  /**
   * Find all the edges fully enclosed by the bounding box.
   * @param edges list of edges to search through
   * @param bbox bounding box to check
   */
  getEdgesWithinBBox(edges: UniversalGraphEdge[], bbox: BoundingBox): UniversalGraphEdge[] {
    const results = [];
    for (let i = edges.length - 1; i >= 0; --i) {
      const d = edges[i];
      const placedEdge = this.placeEdge(d);
      const hookResult = this.behaviors.call('isBBoxEnclosingEdge', placedEdge, bbox);
      if ((hookResult !== undefined && hookResult) || placedEdge.isBBoxEnclosing(bbox)) {
        results.push(d);
      }
    }
    return results;
  }

  /**
   * Find all the groups fully enclosed by the bounding box.
   * @param groups - list of groups to check
   * @param bbox bounding box to check
   */
  getGroupsWithinBBox(groups: UniversalGraphGroup[], bbox: BoundingBox): UniversalGraphGroup[] {
    const results = [];
    for (let i = groups.length - 1; i >= 0; --i) {
      const group = groups[i];
      if (this.placeGroup(group).isBBoxEnclosing(bbox)) {
        results.push(group);
      }
    }
    return results;
  }

  /**
   * Find all the entities fully enclosed by the bounding box.
   * @param bbox bounding box
   */
  getEntitiesWithinBBox(bbox: BoundingBox): GraphEntity[] {
    return [
      ...this.getNodesWithinBBox(this.nodes, bbox).map(entity => ({
        type: GraphEntityType.Node,
        entity,
      })),
      ...this.getEdgesWithinBBox(this.edges, bbox).map(entity => ({
        type: GraphEntityType.Edge,
        entity,
      })),
      ...this.getGroupsWithinBBox(this.groups, bbox).map(entity => ({
        type: GraphEntityType.Group,
        entity,
      })),
    ];
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
   * Focus on the element.
   */
  abstract focus(): void;

  /**
   * Focus the selected entity (aka focus on the related sidebar for the selection).
   */
  abstract focusEditorPanel(): void;

  /**
   * Get the current transform object that is based on the current
   * zoom and pan, which can be used to convert between viewport space and
   * graph space.
   */
  abstract get transform();

  /**
   * Request the graph be re-rendered in the very near future.
   */
  requestRender() {
    this.renderingRequested = true;
  }

  /**
   * Re-render the graph and update the mouse cursor in one shot,
   * freezing up the current thread else until the render completes. If you are just
   * display the graph for the user, never call this method directly. Instead,
   * call {@link requestRender} if a render is needed and make sure to start
   * the animation loop with {@link startAnimationLoop}.
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
   */
  abstract placeEdge(d: UniversalGraphEdge): PlacedEdge;

  /**
   * Place (calculate rendering data) the group onto a canvas and store the result in renderTree.
   * @param d the group
   */
  abstract placeGroup(d: UniversalGraphGroup): PlacedGroup;

  /**
   * Place the given entity onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the entity. The
   * returned object has the style of the entity baked into it.
   * @param d the entity
   */
  placeEntity(d: GraphEntity): PlacedObject {
    if (d.type === GraphEntityType.Node) {
      return this.placeNode(d.entity as UniversalGraphNode);
    } else if (d.type === GraphEntityType.Edge) {
      return this.placeEdge(d.entity as UniversalGraphEdge);
    } else if (d.type === GraphEntityType.Group) {
      return this.placeGroup(d.entity as UniversalGraphGroup);
    } else {
      throw new Error('unknown type: ' + d.type);
    }
  }

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
    const selected = this.selection.getEntitySet();
    if (!selected.size) {
      return false;
    }
    for (const d of entities) {
      if (selected.has(d)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Return if any one of the given items has been highlighted.
   * @param entities a list of entities to check
   */
  isAnyHighlighted(...entities: UniversalGraphEntity[]) {
    const highlighted = this.highlighting.getEntitySet();
    if (!highlighted.size) {
      return false;
    }
    for (const d of entities) {
      if (highlighted.has(d)) {
        return true;
      }
    }
    return false;
  }

  // ========================================
  // Events
  // ========================================

  /**
   * Called when webcola (used for layout) has ticked.
   */
  private colaTicked(): void {
    // TODO: Turn off caching temporarily instead or do something else
    this.invalidateAll();
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
   * Check whether there is anything to undo.
   */
  canUndo() {
    return this.nextHistoryIndex > 0;
  }

  /**
   * Check whether there is anything to redo.
   */
  canRedo() {
    return this.nextHistoryIndex < this.history.length;
  }

  /**
   * Perform an undo, if there is anything to undo.
   * @return the action that was undone, if any
   */
  undo(): GraphAction | undefined {
    // Check to see if there is anything to undo
    if (this.canUndo()) {
      this.nextHistoryIndex--;
      const action = this.history[this.nextHistoryIndex];
      action.rollback(this);
      this.requestRender();
      this.historyChanges$.next();
      return action;
    } else {
      return null;
    }
  }

  /**
   * Perform a redo, if there is anything to redo.
   * @return the action that was redone, if any
   */
  redo(): GraphAction | undefined {
    // Check to see if there is anything to redo
    if (this.canRedo()) {
      const action = this.history[this.nextHistoryIndex];
      action.apply(this);
      this.nextHistoryIndex++;
      this.requestRender();
      this.historyChanges$.next();
      return action;
    } else {
      return null;
    }
  }

  /**
   * Execute an action and store the action to the history stack, while also resetting the
   * history pointer.
   * @param actions the actions to execute (could be an empty array)
   */
  execute(...actions: GraphAction[]): void {
    const length = actions.length;
    try {
      for (const action of actions) {
        // We have unsaved changes, drop all changes after this one
        this.history = this.history.slice(0, this.nextHistoryIndex);
        this.history.push(action);
        this.nextHistoryIndex++;

        // Apply the change
        action.apply(this);
      }
    } finally {
      if (length) {
        this.historyChanges$.next();
        this.requestRender();
      }
    }
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

    this.cola
      .nodes(layoutNodes)
      .links(layoutLinks)
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

enum referenceCheckingMode {
  nodeAdded = 1,
  nodeDeleted = -1,
}
