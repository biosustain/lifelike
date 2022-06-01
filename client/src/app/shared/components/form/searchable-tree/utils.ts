import { SearchableTreeNode } from './inteface';
import { isNotEmpty } from '../../../utils';

export const filterSearchableTreeNode = (
  node: SearchableTreeNode,
  filter: (name: string) => boolean
): SearchableTreeNode => {
  const parsedNode = node.children ? {
    ...node,
    children: node.children.reduce(
      (filteredChildren, child) => {
        const newChild = filterSearchableTreeNode(child, filter);
        if (newChild) {
          filteredChildren.push(newChild);
        }
        return filteredChildren;
      },
      []
    )
  } : node;
  if (isNotEmpty(parsedNode.children) || filter(node.name)) {
    return parsedNode;
  }
};
