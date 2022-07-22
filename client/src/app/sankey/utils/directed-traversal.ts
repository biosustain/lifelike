import { sum } from 'd3-array';

import { SankeyNode } from '../model/sankey-document';

interface Direction {
  nextLinksAccessor: string;
  prevLinksAccessor: string;
  nodeAccessor: string;
}

export const ltr = {
  nextLinksAccessor: 'sourceLinks',
  prevLinksAccessor: 'targetLinks',
  nodeAccessor: 'target'
} as Direction;

export const rtl = {
  nextLinksAccessor: 'targetLinks',
  prevLinksAccessor: 'sourceLinks',
  nodeAccessor: 'source'
} as Direction;

export class DirectedTraversal {
  direction: Direction;
  startNodes: Array<SankeyNode>;
  private endNodes: Array<SankeyNode>;

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
      this.endNodes = outNodes;
    } else {
      this.direction = rtl;
      this.startNodes = outNodes;
      this.endNodes = inNodes;
    }
  }

  reverse() {
    const { direction, startNodes, endNodes } = this;
    this.direction = direction === rtl ? ltr : rtl;
    this.startNodes = endNodes;
    this.endNodes = startNodes;
  }

  depthSorter(asc = true) {
    const { direction } = this;
    const sortDirection = Math.pow(-1, Number(asc !== (direction === ltr)));
    return (a, b) => sortDirection * (a.depth - b.depth);
  }

  nextLinks(node) {
    return node[this.direction.nextLinksAccessor];
  }

  prevLinks(node) {
    return node[this.direction.prevLinksAccessor];
  }

  nextNode = link => link[this.direction.nodeAccessor];
}
