import { partition, sumBy, mean } from 'lodash-es';

import { ExtendedWeakMap } from 'app/shared/utils/types';
import {
  initInputCountCalculation,
  calculateInputCountSkippingCircularLinksA,
  getLinkLayers,
  calculateInputCountSkippingCircularLinksB
} from 'app/sankey/base-views/algorithms/inputCountSharedSteps';
import { SankeyLink, Trace } from 'app/sankey/model/sankey-document';

import { MultiLaneLayoutService } from '../services/multi-lane-layout.service';
import { MultiLaneBaseControllerService } from '../services/multi-lane-base-controller.service';
import { NetworkTraceData } from '../../../interfaces';
import { Base } from '../interfaces';

export function inputCount(
  this: MultiLaneBaseControllerService,
  data: NetworkTraceData<Base>
) {
  const {
    sortedNodes,
    dt,
    maxExpectedValue
  } = initInputCountCalculation.call(this, data);
  calculateInputCountSkippingCircularLinksA.call(this, sortedNodes, dt, maxExpectedValue);
  // estimate circular link values based on trace information (LL-3704)
  const linkLayers = getLinkLayers.call(this, data.links);
  const perLayerLinkEstimation = new ExtendedWeakMap<SankeyLink, number[]>();
  linkLayers.forEach(layer => {
    const [circularLinks, normalLinks] = partition(layer, ({circular}) => circular);
    const circularTraces = new Set(circularLinks.map(({trace}) => trace));
    const traceCircularEstimation = new WeakMap<Trace, number>();
    for (const circularTrace of circularTraces) {
      const traceNormalLinks = normalLinks.filter(({trace}) => trace === circularTrace);
      const traceCircularLinks = circularLinks.filter(({trace}) => trace === circularTrace);
      const traceNormalLinksValue = sumBy(traceNormalLinks, ({value}) => value);
      // each trace should flow only value of one so abs(sum(link values) - sum(circular values)) = 1
      // yet it remains an estimate cause we do not know which circular link contribution to sum
      // ass a good estimate assuming that each circular link contributes equal factor of sum
      // might want to revisit it later
      const traceCircularLinkEstimation = Math.abs(traceNormalLinksValue - 1) / traceCircularLinks.length;
      traceCircularEstimation.set(circularTrace, traceCircularLinkEstimation);
    }
    circularLinks.forEach(circularLink => {
      const circularLinkEstimation = traceCircularEstimation.get(circularLink.trace);
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
