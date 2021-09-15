import * as d3Sankey from 'd3-sankey-circular';
import { representativePositiveNumber } from '../utils';
import { DirectedTraversal } from '../../services/directed-traversal';
import { CustomisedSankeyLayoutService } from '../../services/customised-sankey-layout.service';

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

export const inputCount = ({links, nodes, _inNodes, _outNodes}: any) => {
  links.forEach(l => {
    l._value = 1;
  });
  // @ts-ignore
  const layout = new CustomisedSankeyLayoutService();
  layout.computeNodeLinks({nodes, links});
  layout.identifyCircles({nodes, links});
  layout.computeNodeValues({nodes, links});
  layout.computeNodeDepths({nodes, links});
  const dt = new DirectedTraversal([_inNodes, _outNodes]);
  dt.reverse();
  [...nodes].sort(dt.depthSorter()).forEach(n => {
    if (dt.startNodes.includes(n.id)) {
      n._value = 1;
    } else {
      n._value = 0;
    }
    n._value = dt.prevLinks(n).reduce((a, l) => a + l._value, n._value || 0);
    const outFrac = n._value / dt.nextLinks(n).length;
    dt.nextLinks(n).forEach(l => {
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
