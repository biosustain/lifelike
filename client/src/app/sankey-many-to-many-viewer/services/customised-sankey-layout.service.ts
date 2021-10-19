import { Injectable } from '@angular/core';

import { first, last } from 'lodash-es';

import { TruncatePipe } from 'app/shared/pipes';
import { symmetricDifference } from 'app/sankey-viewer/components/sankey/utils';
import { SankeyNode } from 'app/sankey-viewer/components/interfaces';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { DirectedTraversal } from 'app/sankey-viewer/services/directed-traversal';

import { SankeyManyToManyLink } from '../components/interfaces';

@Injectable()
// @ts-ignore
export class CustomisedSankeyManyToManyLayoutService extends CustomisedSankeyLayoutService {
  constructor(
    readonly truncatePipe: TruncatePipe,
    readonly sankeyController: SankeyControllerService
  ) {
    super(truncatePipe, sankeyController);
  }

  get nodeGraphRelativePosition() {
    return (node: SankeyManyToManyLink) => {
      const {_sourceLinks, _targetLinks, _graphRelativePosition} = node;
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);

      let graphRelativePosition;
      for (const [_trace, link] of difference) {
        let newGraphRelativePosition;
        if (link._source === node) {
          newGraphRelativePosition = 'left';
        } else if (link._target === node) {
          newGraphRelativePosition = 'right';
        }
        if (!graphRelativePosition) {
          graphRelativePosition = newGraphRelativePosition;
        } else if (newGraphRelativePosition !== graphRelativePosition) {
          return 'multiple';
        }
      }
      return graphRelativePosition || _graphRelativePosition;
    };
  }

  get nodeColor() {
    return ({_sourceLinks, _targetLinks, _color}: SankeyNode) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);
      // if it is only one then color node
      if (difference.size === 1) {
        return _color;
      }
    };
  }

  /**
   * Similar to parent method however we are not having graph relaxation
   * node order is calculated by tree structure and this decision is final
   * It calculate nodes position by traversing it from side with less nodes as a tree
   * iteratively figuring order of the nodes.
   */
  computeNodeBreadths(graph) {
    const {columns} = this;

    // decide on direction
    const dt = new DirectedTraversal([first(columns), last(columns)]);
    // order next related nodes in order this group first appeared
    const visited = new Set();
    let order = 0;
    const traceOrder = new Set();
    const relayoutLinks = linksToTraverse =>
      linksToTraverse.forEach(l => {
        relayoutNodes([dt.nextNode(l)]);
        traceOrder.add(l._trace);
      });
    const relayoutNodes = nodesToTraverse =>
      nodesToTraverse.forEach(node => {
        if (visited.has(node)) {
          return;
        }
        visited.add(node);
        node._order = order++;
        const links = dt.nextLinks(node);
        relayoutLinks(links);
      });
    // traverse tree of connections
    relayoutNodes(dt.startNodes);

    this.linkSort = (a, b) => (
      // sort by order given in tree traversal
      (a._source._order - b._source._order) ||
      (a._target._order - b._target._order)
    );

    this.layoutNodesWithinColumns(columns);
  }
}
