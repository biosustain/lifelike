import { partition, flatMap, sumBy, mean } from 'lodash-es';

import { ExtendedWeakMap } from 'app/shared/utils/types';
import {
  calculateInputCountSkippingCircularLinksB,
  calculateInputCountSkippingCircularLinksA,
  initInputCountCalculation,
  getLinkLayers
} from 'app/sankey/base-views/algorithms/inputCountSharedSteps';

import { Base } from '../interfaces';
import { SingleLaneLayoutService } from '../services/single-lane-layout.service';
import { NetworkTraceData } from '../../../interfaces';

export function inputCount(
  this: SingleLaneLayoutService,
  data: Base['data']
) {
  const {
    sortedNodes,
    dt,
    maxExpectedValue
  } = initInputCountCalculation.call(this, data);
  calculateInputCountSkippingCircularLinksA.call(this, sortedNodes, dt, maxExpectedValue);
  // estimate circular link values based on trace information (LL-3704)
  const linkLayers: Map<number, Base['link'][]> = getLinkLayers.call(this, data.links);
  const perLayerLinkEstimation = new ExtendedWeakMap<Base['link'], number[]>();
  linkLayers.forEach(layer => {
    const [circularLinks, normalLinks] = partition(layer, ({circular}) => circular);
    const circularTraces = new Set(flatMap(circularLinks, ({traces}) => traces));
    const traceCircularEstimation = new WeakMap<Base['trace'], number>();
    for (const circularTrace of circularTraces) {
      const traceNormalLinks = normalLinks.filter(({traces}) => traces.includes(circularTrace));
      const traceCircularLinks = circularLinks.filter(({traces}) => traces.includes(circularTrace));
      const traceNormalLinksValue = sumBy(traceNormalLinks, ({value}) => value);
      // each trace should flow only value of one so abs(sum(link values) - sum(circular values)) = 1
      // yet it remains an estimate cause we do not know which circular link contribution to sum
      // ass a good estimate assuming that each circular link contributes equal factor of sum
      // might want to revisit it later
      const traceCircularLinkEstimation = Math.abs(traceNormalLinksValue - 1) / traceCircularLinks.length;
      traceCircularEstimation.set(circularTrace, traceCircularLinkEstimation);
    }
    circularLinks.forEach(circularLink => {
      const circularLinkEstimation = sumBy(circularLink.traces, trace => traceCircularEstimation.get(trace));
      const estimations = perLayerLinkEstimation.getSet(circularLink, []);
      estimations.push(circularLinkEstimation);
    });
    circularLinks.forEach(circularLink => {
      circularLink.value = mean(perLayerLinkEstimation.get(circularLink));
      delete circularLink.multipleValues;
      this.warningController.assert(circularLink.value <= maxExpectedValue,
        'Input count algorithm fail - node value exceeds input node count');
    });
  });
  // propagate changes
  calculateInputCountSkippingCircularLinksB.call(this, sortedNodes, dt, maxExpectedValue);

  return {
    nodes: data.nodes
      .filter(n => n.sourceLinks.length + n.targetLinks.length > 0),
    links: data.links,
    _sets: {
      link: {
        value: true,
        multipleValues: false
      }
    }
  };
}
