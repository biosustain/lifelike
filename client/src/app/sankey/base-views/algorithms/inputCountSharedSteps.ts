import { clone } from 'lodash-es';

import { ExtendedMap } from 'app/shared/utils/types';
import { NetworkTraceData, TypeContext } from 'app/sankey/interfaces';
import { SankeyLink, SankeyNode } from 'app/sankey/model/SankeyDocument';

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
    n.value = dt.startNodes.includes(n) ? 1 : 0;
    const prevLinks = dt.prevLinks(n);
    const nextLinks = dt.nextLinks(n);
    n.value = prevLinks.reduce((a, l) => a + (l.value ?? 0), n.value);
    this.warningController.assert(
      // JS floats calculations has very limited precision which can lead to rounding error in here
      n.value.toPrecision(5) <= maxExpectedValue,
      'Input count algorithm fail - node value exceeds input node count'
    );
    const outFrac = nextLinkValue(n.value, nextLinks);
    nextLinks.forEach(l => {
      // skip setting circular values
      if (!l.circular) {
        l.value = outFrac;
      }
      delete l.multipleValues;
    });
  });
}

export function initInputCountCalculation(
  this: DefaultLayoutService,
  data: NetworkTraceData<TypeContext>
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
    const sourceLayer = (link.source as SankeyNode).layer;
    const targetLayer = (link.target as SankeyNode).layer;
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
      const nextNonCircularLinks = nextLinks.filter(({circular}) => !circular);
      const nextCircularLinksSum = nextLinks.filter(({circular}) => circular).reduce((acc, l) => acc + l.value, 0);
      return (nodeValue - nextCircularLinksSum) / nextNonCircularLinks.length;
    }
  );
}
