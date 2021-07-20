import * as d3Sankey from 'd3-sankey';
import { TruncatePipe } from '../../../shared/pipes';

export class AttributeAccessors {
  get id(): (d: SankeyNode, i?: number, n?: Array<SankeyNode>) => number | string {
    return ({id}) => id;
  }

  get nodeLabel() {
    return ({label = ''}) => label;
  }

  get nodeLabelShort() {
    const {nodeLabel, truncatePipe: { transform }} = this;
    return n => transform(nodeLabel(n), AttributeAccessors.labelEllipsis);
  }

  get nodeLabelShouldBeShorted() {
    const {nodeLabel} = this;
    return n => nodeLabel(n).length > AttributeAccessors.labelEllipsis;
  }

  get nodeColor() {
    return ({_color}) => _color;
  }

  get linkColor() {
    return ({_color}) => _color;
  }

  get nodeTitle(): (node: SankeyNode) => string {
    return ({description}) => description;
  }

  get value() {
    return ({_value}) => _value;
  }

  get linkPath() {
    return d3Sankey.sankeyLinkHorizontal();
  }

  get circular() {
    return ({_circular}) => _circular;
  }

  static labelEllipsis = 10;
  // inheritance in angular makes it hard to use DI
  readonly truncatePipe = new TruncatePipe();
}
