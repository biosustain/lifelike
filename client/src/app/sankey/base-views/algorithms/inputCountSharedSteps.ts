import { clone } from 'lodash-es';

import { ExtendedMap } from 'app/shared/utils/types';
import { SankeyLink, SankeyNode, NetworkTraceData } from 'app/sankey/interfaces';

import { DirectedTraversal } from '../../utils/directed-traversal';
import { DefaultLayoutService } from '../../services/layout.service';

export function calculateInputCountSkippingCircularLinks(
  this: DefaultLayoutService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number,
  nextLinkValue: (nodeValue: number, nextLinks) => number
) {
  sortedNodes.forEach(n => {
    n._value = dt.startNodes.includes(n.id) ? 1 : 0;
    const prevLinks = dt.prevLinks(n);
    const nextLinks = dt.nextLinks(n);
    n._value = prevLinks.reduce((a, l) => a + (l._value ?? 0), n._value);
    this.warningController.assert(
      // JS floats calculations has very limited precision which can lead to rounding error in here
      n._value.toPrecision(5) <= maxExpectedValue,
      'Input count algorithm fail - node value exceeds input node count'
    );
    const outFrac = nextLinkValue(n._value, nextLinks);
    nextLinks.forEach(l => {
      // skip setting circular values
      if (!l._circular) {
        l._value = outFrac;
      }
      delete l._multiple_values;
    });
  });
}

export function initInputCountCalculation(
  this: DefaultLayoutService,
  data: NetworkTraceData
) {
  // traverse from side with less nodes
  const dt = new DirectedTraversal([data.sources, data.targets]);
  // traverse starting from leaves nodes
  dt.reverse();
  return {
    dt,
    // for checks
    maxExpectedValue: dt.startNodes.length,
    // iterate nodes leaves first
    sortedNodes: clone(data.nodes).sort(dt.depthSorter())
  };
}

/**
 * make lists of links passing each immediate space between node layers
 */
export function getLinkLayers<Link extends SankeyLink>(
  this: DefaultLayoutService,
  links: Link[]
): Map<number, Link[]> {
  const linkLayers = new ExtendedMap<number, Link[]>();
  links.forEach(link => {
    const sourceLayer = (link._source as SankeyNode)._layer;
    const targetLayer = (link._target as SankeyNode)._layer;
    const minLayer = Math.min(sourceLayer, targetLayer);
    const maxLayer = Math.max(sourceLayer, targetLayer);
    for (let layer = minLayer; layer < maxLayer; layer++) {
      const layerLinks = linkLayers.getSet(layer, []);
      layerLinks.push(link as Link);
    }
  });
  return linkLayers;
}

export function calculateInputCountSkippingCircularLinksA(
  this: DefaultLayoutService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number
) {
  calculateInputCountSkippingCircularLinks.call(
    this,
    sortedNodes,
    dt,
    maxExpectedValue,
    (nodeValue, nextLinks) =>
      nodeValue / nextLinks.length
  );
}

export function calculateInputCountSkippingCircularLinksB(
  this: DefaultLayoutService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number
) {
  calculateInputCountSkippingCircularLinks.call(
    this,
    sortedNodes,
    dt,
    maxExpectedValue,
    (nodeValue, nextLinks) => {
      const nextNonCircularLinks = nextLinks.filter(({_circular}) => !_circular);
      const nextCircularLinksSum = nextLinks.filter(({_circular}) => _circular).reduce((acc, l) => acc + l._value, 0);
      return (nodeValue - nextCircularLinksSum) / nextNonCircularLinks.length;
    }
  );
}
