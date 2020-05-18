/**
 * This file contains actions for the graph, such as adding or removing nodes,
 * which may be committed to history for rollback or re-application.
 */

import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

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
   * @return true if the node was found
   */
  removeNode(node: UniversalGraphNode): void;
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
