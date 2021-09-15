import * as d3Sankey from 'd3-sankey-circular';
import { representativePositiveNumber } from '../utils';
import { DirectedTraversal } from '../../services/directed-traversal';

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
    .nodeId(n => n._id)
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
  // region TODO: once layout service supports circular rel it should be used instead
  // this is temporary workaround
  links.forEach(l => {
    l.value = 1;
    l.s = l.source;
    l.t = l.target;
  });
  d3Sankey.sankeyCircular()
    .nodeId(n => n._id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  nodes.forEach(n => {
    n._sourceLinks = n.sourceLinks;
    n._targetLinks = n.targetLinks;
  });
  // endregion
  const dt = new DirectedTraversal([_inNodes, _outNodes]);
  dt.reverse();
  [...nodes].sort(dt.depthSorter()).forEach(n => {
    if (dt.startNodes.includes(n._id)) {
      n.value = 1;
    } else {
      n.value = 0;
    }
    n.value = dt.prevLinks(n).reduce((a, l) => a + l.value, n.value || 0);
    const outFrac = n.value / dt.nextLinks(n).length;
    dt.nextLinks(n).forEach(l => {
      l.value = outFrac;
    });
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
              _sourceLinks,
              _targetLinks,
              layer,
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
