import * as d3Sankey from 'd3-sankey';

import { TruncatePipe } from 'app/shared/pipes';

import { SankeyNode } from '../interfaces';

export class AttributeAccessors {
  constructor(readonly truncatePipe: TruncatePipe) {
  }

  get id(): (d: SankeyNode, i?: number, n?: Array<SankeyNode>) => number | string {
    return ({id}) => id;
  }

  get nodeLabel() {
    return ({label = ''}) => label;
  }

  get nodeLabelShort() {
    const {nodeLabel, truncatePipe: {transform}} = this;
    return n => transform(nodeLabel(n), AttributeAccessors.labelEllipsis);
  }

  get nodeLabelShouldBeShorted() {
    const {nodeLabel} = this;
    return n => nodeLabel(n).length > AttributeAccessors.labelEllipsis;
  }

  get nodeColor() {
    return ({_color}: SankeyNode) => _color;
  }

  get linkColor() {
    return ({_color}) => _color;
  }

  get nodeTitle(): (node: SankeyNode) => string {
    return ({description}) => description;
  }

  get linkTitle(): (node: SankeyNode) => string {
    return ({description}) => description;
  }

  get value() {
    return ({_value = 0}) => _value;
  }

  get linkPath() {
    return d3Sankey.sankeyLinkHorizontal();
  }

  get circular() {
    return ({_circular}) => _circular;
  }

  get fontSize() {
    return (d?, i?, n?) => 12;
  }

  static labelEllipsis = 10;
}
