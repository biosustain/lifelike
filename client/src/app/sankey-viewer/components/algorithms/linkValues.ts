import * as d3Sankey from 'd3-sankey-circular';

import { representativePositiveNumber } from '../utils';
import { DirectedTraversal } from '../../services/directed-traversal';
import { CustomisedSankeyLayoutService } from '../../services/customised-sankey-layout.service';
import { SankeyData, SankeyLink, SankeyNode } from '../interfaces';

export const fixedValue = value => ({links}) => {
  links.forEach(l => {
    l._value = value;
  });
  return {
    links,
    _sets: {
      link: {
        _value: true
      }
    }
  };
};

export const fractionOfFixedNodeValue = ({links, nodes}) => {
  links.forEach(l => {
    l.value = 1;
    l.s = l.source;
    l.t = l.target;
  });
  nodes.forEach(n => n.fixedValue = n._fixedValue);
  d3Sankey.sankeyCircular()
    .nodeId(n => n.id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  links.forEach(l => {
    const [sv, tv] = l._multiple_values = [
      l.source.fixedValue / l.source.sourceLinks.length,
      l.target.fixedValue / l.target.targetLinks.length
    ];
    l._value = (sv + tv) / 2;
  });
  return {
    nodes: nodes
      .filter(n => n.sourceLinks.length + n.targetLinks.length > 0)
      .map(({
              value,
              depth,
              index,
              height,
              sourceLinks,
              targetLinks,
              layer,
              fixedValue: _,
              x0, x1,
              y0, y1,
              ...node
            }) => ({
        ...node
      })),
    links: links.map(({
                        value = 0.001,
                        y0, y1,
                        s, t,
                        ...link
                      }) => ({
      ...link,
      _value: value,
      source: s,
      target: t
    })),
    _sets: {
      link: {
        _value: true
      }
    }
  };
};

export const inputCount = ({links, nodes, _inNodes, _outNodes}: SankeyData) => {
  // initially links does not carry values but we need to init it
  links.forEach(l => {
    l._value = 0;
  });
  // @ts-ignore
  const layout = new CustomisedSankeyLayoutService();
  // don't calculate whole layout, only things needed to get nodes depths
  layout.computeNodeLinks({nodes, links});
  layout.identifyCircles({nodes, links});
  layout.computeNodeValues({nodes, links});
  layout.computeNodeDepths({nodes, links});
  layout.computeNodeLayers({nodes});
  // traverse from side with less nodes
  const dt = new DirectedTraversal([_inNodes, _outNodes]);
  // traverse starting from leaves nodes
  dt.reverse();
  // for checks
  const maxExpectedValue = dt.startNodes.length;
  // iterate nodes leaves first
  const sortedNodes = [...nodes].sort(dt.depthSorter());
  sortedNodes.forEach(n => {
    if (dt.startNodes.includes(n.id)) {
      n._fixedValue = 1;
    } else {
      n._fixedValue = 0;
    }
    const prevLinks = dt.prevLinks(n);
    const nextLinks = dt.nextLinks(n);
    const minPrev = Math.min(...prevLinks.map(({_value}) => _value));
    n._fixedValue = prevLinks.reduce((a, l) => a + l._value, n._fixedValue || 0);
    console.assert(n._fixedValue <= maxExpectedValue);
    const outFrac = n._fixedValue / nextLinks.length;
    nextLinks.forEach(l => {
      // do fist calculation ignoring circular link values
      if (!l._circular) {
        l._value = outFrac;
      }
    });
  });
  // estimate circular link values based on trace information (LL-3704)
  // make lists of links passing each immediate space between node layers
  const linkLayers = new Map<number, SankeyLink[]>();
  links.forEach(link => {
    const sourceLayer = (link._source as SankeyNode)._layer;
    const targetLayer = (link._target as SankeyNode)._layer;
    const minLayer = Math.min(sourceLayer, targetLayer);
    const maxLayer = Math.max(sourceLayer, targetLayer);
    for (let layer = minLayer; layer < maxLayer; layer++) {
      let traceLayerLinks: SankeyLink[] = linkLayers.get(layer);
      if (!traceLayerLinks) {
        traceLayerLinks = [];
        linkLayers.set(layer, traceLayerLinks);
      }
      traceLayerLinks.push(link);
    }
  });
  links.filter(({_circular}) => _circular).forEach(link => {
    const sourceLayer = (link._source as SankeyNode)._layer;
    const targetLayer = (link._target as SankeyNode)._layer;
    const minLayer = Math.min(sourceLayer, targetLayer);
    const maxLayer = Math.max(sourceLayer, targetLayer);
    for (let layer = minLayer; layer < maxLayer; layer++) {
      const [traceLayerLinksCircular, traceLayerLinksNormalValue] = linkLayers.get(layer).reduce(
        ([circular, normalValue], l) => {
          if (l._trace === link._trace) {
            if (l._circular) {
              circular.push(l);
            } else {
              normalValue += l._value;
            }
          }
          return [circular, normalValue];
        },
        [[], 0]
      );
      // each trace should flow only value of one so abs(sum(link values) - sum(circular values)) = 1
      // yet it remains an estimate cause we do not know which circular link contribution to sum
      // ass a good estimate assuming that each circular link contributes equal factor of sum
      // might want to revisit it later
      const circularValueEstimate = Math.abs(traceLayerLinksNormalValue - 1) / traceLayerLinksCircular.length;
      console.assert(circularValueEstimate <= maxExpectedValue);
      traceLayerLinksCircular.forEach(l => {
        l._value = circularValueEstimate;
      });
    }
  });
  // propagate changes
  sortedNodes.forEach(n => {
    if (dt.startNodes.includes(n.id)) {
      n._fixedValue = 1;
    } else {
      n._fixedValue = 0;
    }
    const prevLinks = dt.prevLinks(n);
    const nextLinks = dt.nextLinks(n);
    const nextNonCircularLinks = nextLinks.filter(({_circular}) => !_circular);
    const nextCircularLinksSum = nextLinks.filter(({_circular}) => _circular).reduce((acc, l) => acc + l._value, 0);
    n._fixedValue = prevLinks.reduce((a, l) => a + l._value, n._fixedValue || 0);
    const outFrac = (n._fixedValue - nextCircularLinksSum) / nextNonCircularLinks.length;
    nextNonCircularLinks.forEach(l => {
      l._value = outFrac;
    });
  });

  return {
    nodes: nodes
      .filter(n => n._sourceLinks.length + n._targetLinks.length > 0),
    links,
    _sets: {
      link: {
        _value: true
      }
    }
  };
};

export const byProperty = property => ({links}) => {
  links.forEach(l => {
    l._value = representativePositiveNumber(l[property]);
  });
  return {
    _sets: {
      link: {
        _value: true
      }
    },
    _requires: {
      link: {
        _adjacent_normalisation: true
      }
    }
  };
};

export const byArrayProperty = property => ({links}) => {
  links.forEach(l => {
    const [v1, v2] = l[property];
    l._multiple_values = [v1, v2].map(d => representativePositiveNumber(d));
    // take max for layer calculation
    l._value = Math.max(...l._multiple_values);
  });
  return {
    _sets: {
      link: {
        _multiple_values: true,
        _value: true
      }
    },
    _requires: {
      link: {
        _adjacent_normalisation: true
      }
    }
  };
};
