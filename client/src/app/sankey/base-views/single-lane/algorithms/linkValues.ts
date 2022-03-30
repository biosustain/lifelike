import { partition, flatMap, sumBy, mean } from 'lodash-es';

import { ExtendedWeakMap } from 'app/shared/utils/types';
import {
  calculateInputCountSkippingCircularLinksB,
  calculateInputCountSkippingCircularLinksA,
  initInputCountCalculation,
  getLinkLayers
} from 'app/sankey/base-views/algorithms/inputCountSharedSteps';
import { SankeyTrace } from 'app/sankey/interfaces';

import { SankeySingleLaneLink, SankeySingleLaneData } from '../interfaces';
import { SingleLaneLayoutService } from '../services/single-lane-layout.service';

export function inputCount(
  this: SingleLaneLayoutService,
  data: SankeySingleLaneData
) {
  const {
    sortedNodes,
    dt,
    maxExpectedValue
  } = initInputCountCalculation.call(this, data);
  calculateInputCountSkippingCircularLinksA.call(this, sortedNodes, dt, maxExpectedValue);
  // estimate circular link values based on trace information (LL-3704)
  const linkLayers: Map<number, SankeySingleLaneLink[]> = getLinkLayers.call(this, data.links);
  const perLayerLinkEstimation = new ExtendedWeakMap<SankeySingleLaneLink, number[]>();
  linkLayers.forEach(layer => {
    const [circularLinks, normalLinks] = partition(layer, ({_circular}) => _circular);
    const circularTraces = new Set(flatMap(circularLinks, ({_traces}) => _traces));
    const traceCircularEstimation = new WeakMap<SankeyTrace, number>();
    for (const circularTrace of circularTraces) {
      const traceNormalLinks = normalLinks.filter(({_traces}) => _traces.includes(circularTrace));
      const traceCircularLinks = circularLinks.filter(({_traces}) => _traces.includes(circularTrace));
      const traceNormalLinksValue = sumBy(traceNormalLinks, ({_value}) => _value);
      // each trace should flow only value of one so abs(sum(link values) - sum(circular values)) = 1
      // yet it remains an estimate cause we do not know which circular link contribution to sum
      // ass a good estimate assuming that each circular link contributes equal factor of sum
      // might want to revisit it later
      const traceCircularLinkEstimation = Math.abs(traceNormalLinksValue - 1) / traceCircularLinks.length;
      traceCircularEstimation.set(circularTrace, traceCircularLinkEstimation);
    }
    circularLinks.forEach(circularLink => {
      const circularLinkEstimation = sumBy(circularLink._traces, _trace => traceCircularEstimation.get(_trace));
      const estimations = perLayerLinkEstimation.getSet(circularLink, []);
      estimations.push(circularLinkEstimation);
    });
    circularLinks.forEach(circularLink => {
      circularLink._value = mean(perLayerLinkEstimation.get(circularLink));
      delete circularLink._multiple_values;
      this.warningController.assert(circularLink._value <= maxExpectedValue,
        'Input count algorithm fail - node value exceeds input node count');
    });
  });
  // propagate changes
  calculateInputCountSkippingCircularLinksB.call(this, sortedNodes, dt, maxExpectedValue);

  return {
    nodes: data.nodes
      .filter(n => n._sourceLinks.length + n._targetLinks.length > 0),
    links: data.links,
    _sets: {
      link: {
        _value: true,
        _multiple_values: false
      }
    }
  };
}
