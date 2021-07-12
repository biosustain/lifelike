import * as d3Sankey from 'd3-sankey-circular';
import { representativePositiveNumber } from '../utils';

export const fractionOfFixedNodeValue = ({links, nodes}) => {
  links.forEach(l => l.value = 1);
  d3Sankey.sankeyCircular()
    .nodeId(n => n.id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  links.forEach(l => {
    const [sv, tv] = l.multiple_values = [
      l.source.fixedValue / l.source.sourceLinks.length,
      l.target.fixedValue / l.target.targetLinks.length
    ];
    l.value = (sv + tv) / 2;
  });
  return {
    nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0),
    links: links.map(
      ({
         value = 0.001,
         ...link
       }) => ({
        ...link,
        value
      })),
    _sets: {
      link: {
        value: true
      }
    }
  };
};
export const inputCount = ({links, nodes, inNodes}: Partial<SankeyData>) => {
  links.forEach(l => l.value = 1);
  d3Sankey.sankeyCircular()
    .nodeId(n => n.id)
    .nodePadding(1)
    .nodePaddingRatio(0.5)
    .nodeAlign(d3Sankey.sankeyRight)
    .nodeWidth(10)
    ({nodes, links});
  nodes.sort((a, b) => a.depth - b.depth).forEach(n => {
    if (inNodes.includes(n.id)) {
      n.value = 1;
    } else {
      n.value = 0;
    }
    n.value = n.targetLinks.reduce((a, l) => a + l.value, n.value || 0);
    const outFrac = n.value / n.sourceLinks.length;
    n.sourceLinks.forEach(l => {
      l.value = outFrac;
    });
  });
  return {
    nodes: nodes.filter(n => n.sourceLinks.length + n.targetLinks.length > 0),
    links: links.map(({
                        value = 0.001,
                        ...link
                      }) => ({
      ...link,
      value
    })),
    _sets: {
      link: {
        value: true
      }
    }
  };
};
export const linkSizeByProperty = property => ({links}) => {
  links.forEach(l => {
    l.value = representativePositiveNumber(l[property]);
  });
  return {
    _sets: {
      link: {
        value: true
      }
    },
    _requires: {
      link: {
        adjacent_normalisation: true
      }
    }
  };
};
export const linkSizeByArrayProperty = property => ({links}) => {
  links.forEach(l => {
    const [v1, v2] = l[property];
    l.multiple_values = [v1, v2].map(d => representativePositiveNumber(d));
    // take max for layer calculation
    l.value = Math.max(...l.multiple_values);
  });
  return {
    _sets: {
      link: {
        multiple_values: true,
        value: true
      }
    },
    _requires: {
      link: {
        adjacent_normalisation: true
      }
    }
  };
};
