import { SearchableTreeNode } from './inteface';
import { isNotEmpty } from '../../../utils';

/**
 * Return hierarhy filtered by callback
 */
export const filterSearchableTreeNode = (
  node: SearchableTreeNode,
  filter: (name: string) => boolean
): SearchableTreeNode => {
  let parsedNode;
  if (node.children) {
    const newChildren = node.children.reduce(
      (filteredChildren, child) => {
        const newChild = filterSearchableTreeNode(child, filter);
        if (newChild) {
          filteredChildren.push(newChild);
        }
        return filteredChildren;
      },
      []
    );
    if (newChildren.length !== node.children.length) {
      parsedNode = { ...node, children: newChildren };
    }
  }
  if (!parsedNode) {
    parsedNode = node;
  }
  if (isNotEmpty(parsedNode.children) || filter(node.name)) {
    return parsedNode;
  }
};
