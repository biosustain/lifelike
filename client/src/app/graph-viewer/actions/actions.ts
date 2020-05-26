/**
 * This file contains actions for the graph, such as adding or removing nodes,
 * which may be committed to history for rollback or re-application.
 */

import { UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

/**
 * A graph component manages a graph and may render it.
 */
export interface GraphActionReceiver {
  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void;

  /**
   * Remove the given node from the graph.
   * @param node the node
   */
  removeNode(node: UniversalGraphNode): {
    found: boolean,
    removedEdges: UniversalGraphEdge[],
  };

  /**
   * Mark the node as being updated.
   * @param node the node
   */
  updateNode(node: UniversalGraphNode): void;

  /**
   * Add the given edge to the graph.
   * @param edge the edge
   */
  addEdge(edge: UniversalGraphEdge): void;

  /**
   * Remove the given edge from the graph.
   * @param edge the edge
   * @return true if the edge was found
   */
  removeEdge(edge: UniversalGraphEdge): boolean;

  /**
   * Mark the edge as being updated.
   * @param edge the node
   */
  updateEdge(edge: UniversalGraphEdge): void;
}

/**
 * An action is something the user performed on a {@link GraphActionReceiver}
 * that can be applied or rolled back.
 */
export interface GraphAction {
  /**
   * A user friendly description of the action for a history log.
   */
  description: string;

  /**
   * Called to perform the action.
   * @param component the component with the graph
   */
  apply: (component: GraphActionReceiver) => void;

  /**
   * Called to undo the action.
   * @param component the component with the graph
   */
  rollback: (component: GraphActionReceiver) => void;
}
