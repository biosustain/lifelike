import * as d3Sankey from 'd3-sankey-circular';

import { isNotEmpty } from 'app/shared/utils';

import { representativePositiveNumber } from '../utils';
import { DefaultLayoutService } from '../services/layout.service';
import { ValueProcessingStep } from '../interfaces/valueAccessors';

export const fixedValue: (value: number) => ValueProcessingStep =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l._value = value;
        delete l._multiple_values;
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

export function fractionOfFixedNodeValue(this: DefaultLayoutService, {links, nodes}) {
  links.forEach(l => {
    l.value = 1;
    l.s = l.source;
    l.t = l.target;
  });
  nodes.forEach(n => n.fixedValue = n._value);
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
      .filter(n => isNotEmpty(n.sourceLinks) || isNotEmpty(n.targetLinks))
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
            }) =>
        node
      ),
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
}

export const byProperty: (property: string) => ValueProcessingStep =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l._value = representativePositiveNumber(l[property]);
        delete l._multiple_values;
      });
      return {
        _sets: {
          link: {
            _value: true,
            _multiple_values: false
          }
        },
        _requires: {
          link: {
            _adjacent_normalisation: true
          }
        }
      };
    };


export const byArrayProperty: (property: string) => ValueProcessingStep =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        const [v1, v2] = l[property];
        l._multiple_values = [v1, v2].map(d => representativePositiveNumber(d)) as [number, number];
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
