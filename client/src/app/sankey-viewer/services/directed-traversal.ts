import { sum } from 'd3-array';

interface Direction {
  linksAccessor: string;
  nodeAccessor: string;
}

const ltr = {
  linksAccessor: 'sourceLinks',
  nodeAccessor: 'target'
} as Direction;

const rtl = {
  linksAccessor: 'targetLinks',
  nodeAccessor: 'source'
} as Direction;

export class DirectedTraversal {
  direction: Direction;
  startNodes: Array<any>;

  constructor([inNodes, outNodes]) {
    // figure out if we traverse ltr or rtl based on the number of nodes on each side (and their links)
    // side with smaller number of nodes; less links is the one we start with
    if (((
      inNodes.length
      - outNodes.length
    ) || (
      sum(outNodes, ({targetLinks = []}) => targetLinks.length)
      - sum(inNodes, ({sourceLinks = []}) => sourceLinks.length)
    )) < 0) {
      this.direction = ltr;
      this.startNodes = inNodes;
    } else {
      this.direction = rtl;
      this.startNodes = outNodes;
    }
  }

  nextLinks(node) {
    return node[this.direction.linksAccessor];
  }

  nextNode(link) {
    return link[this.direction.nodeAccessor];
  }
}
