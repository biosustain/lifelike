import { Prescaler, ArrayWithDefault } from '../interfaces';
import { computeNodeLinks } from './d3-sankey/d3-sankey';

const calcNormalisationFactor = (nodeValue, linkValues, log) => {
  const sumOfLinks = linkValues.reduce((v, l) => v + l, 0);
  const sumOfLogLinks = linkValues.reduce((v, l) => v + log(l), 0);
  const valBias = nodeValue - sumOfLinks;
  return log(nodeValue) / (sumOfLogLinks + log(valBias < 0 ? 0 : valBias));
};

function normalize(data, key, accessor = d => d) {
  const values = data.map(d => accessor(d)[key]);
  const [min, max] = values.reduce((o, d) => [Math.min(o[0] || 0, d), Math.max(o[1] || 0, d)], [0, 0]);
  data.forEach(d => {
    accessor(d)[key] = (accessor(d)[key] - min) / (max - min);
  });
}

const logScale = (log = Math.log) => data => {
  computeNodeLinks(data);

  data.nodes.forEach(n => {
    n.sn =
      calcNormalisationFactor(
        n.fixedValue,
        n.sourceLinks.map(({multiple_values, value}) => multiple_values ? multiple_values[0] : value),
        log
      );
    n.tn =
      calcNormalisationFactor(
        n.fixedValue,
        n.targetLinks.map(({multiple_values, value}) => multiple_values ? multiple_values[1] : value),
        log
      );
    n.fixedValue = log(n.fixedValue);
  });

  data.links.forEach(l => {
    l.multiple_values = [
      log(l.multiple_values[0]) * l.source.sn,
      log(l.multiple_values[1]) * l.target.tn
    ];
  });


  normalize(data.nodes, 'fixedValue');
  normalize(data.links, 'value');
  normalize(data.links, 0, d => d.multiple_values);
  normalize(data.links, 1, d => d.multiple_values);
};

const prescalers: ArrayWithDefault<Prescaler> = [
  {
    name: 'None',
    description: 'No transformation',
    fn: (v: number) => v
  },
  {
    name: 'ln',
    description: 'Natural logarithm',
    process: logScale(Math.log)
  },
  {
    name: 'log2',
    description: 'Base-2 logarithm',
    process: logScale(Math.log2)
  },
  {
    name: 'log10',
    description: 'Base-10 logarithm',
    process: logScale(Math.log10)
  },
  {
    name: 'sqrt',
    description: 'Square root',
    fn: Math.sqrt
  },
  {
    name: 'cbrt',
    description: 'Cube root',
    fn: Math.cbrt
  },
  {
    name: '1/x',
    description: 'Value multiplicative inverse',
    fn: v => 1 / v
  },
  {
    name: 'arctan',
    description: 'Arctangent',
    fn: Math.atan
  }
];

prescalers.default = prescalers[0];

export default prescalers;


