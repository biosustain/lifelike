import * as d3Sankey from 'd3-sankey-circular';

import { isNotEmpty } from 'app/shared/utils';

import { representativePositiveNumber } from '../utils';
import { DefaultLayoutService } from '../services/layout.service';
import { ValueProcessingStep } from '../interfaces/valueAccessors';
import { NetworkTraceData, TypeContext } from '../interfaces';

export const fixedValue: (value: number) => ValueProcessingStep<TypeContext> =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l.value = value;
        delete l.multipleValues;
      });
      return {
        links,
        _sets: {
          link: {
            value: true
          }
        }
      };
    };

// export function fractionOfFixedNodeValue(this: DefaultLayoutService, {links, nodes}: NetworkTraceData) {
//   links.forEach(l => {
//     l.value = 1;
//     l.s = l.source;
//     l.t = l.target;
//   });
//   nodes.forEach(n => n.fixedValue = n.value);
//   d3Sankey.sankeyCircular()
//     .nodeId(n => n.id)
//     .nodePadding(1)
//     .nodePaddingRatio(0.5)
//     .nodeAlign(d3Sankey.sankeyRight)
//     .nodeWidth(10)
//     ({nodes, links});
//   links.forEach(l => {
//     const [sv, tv] = l.multipleValues = [
//       l.source.fixedValue / l.source.sourceLinks.length,
//       l.target.fixedValue / l.target.targetLinks.length
//     ];
//     l.value = (sv + tv) / 2;
//   });
//   return {
//     nodes: nodes
//       .filter(n => isNotEmpty(n.sourceLinks) || isNotEmpty(n.targetLinks))
//       .map(({
//               value,
//               depth,
//               index,
//               height,
//               sourceLinks,
//               targetLinks,
//               layer,
//               fixedValue: _,
//               x0, x1,
//               y0, y1,
//               ...node
//             }) =>
//         node
//       ),
//     links: links.map(({
//                         value = 0.001,
//                         y0, y1,
//                         s, t,
//                         ...link
//                       }) => ({
//       ...link,
//       value: value,
//       source: s,
//       target: t
//     })),
//     _sets: {
//       link: {
//         value: true
//       }
//     }
//   };
// }

export const byProperty: (property: string) => ValueProcessingStep<TypeContext> =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l.value = representativePositiveNumber(l[property]);
        delete l.multipleValues;
      });
      return {
        _sets: {
          link: {
            value: true,
            multipleValues: false
          }
        },
        _requires: {
          link: {
            _adjacent_normalisation: true
          }
        }
      };
    };


export const byArrayProperty: (property: string) => ValueProcessingStep<TypeContext> =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        const [v1, v2] = l[property];
        l.multipleValues = [v1, v2].map(d => representativePositiveNumber(d)) as [number, number];
        // take max for layer calculation
        l.value = Math.max(...l.multipleValues);
      });
      return {
        _sets: {
          link: {
            multipleValues: true,
            value: true
          }
        },
        _requires: {
          link: {
            _adjacent_normalisation: true
          }
        }
      };
    };
