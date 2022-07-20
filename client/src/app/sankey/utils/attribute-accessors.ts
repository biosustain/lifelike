import { ValueFn } from 'd3-selection';

import { TruncatePipe } from 'app/shared/pipes';

import { TypeContext } from '../interfaces';

export abstract class AttributeAccessors<Base extends TypeContext> {
  constructor(protected readonly truncatePipe: TruncatePipe) {
  }

  get id(): ValueFn<any, Base['node'] | Base['link'], number | string> {
    return ({id}) => id;
  }

  get nodeLabel(): ValueFn<any, Base['node'], string> {
    return ({label = ''}) => label;
  }

  // color can be object with toString method
  get nodeColor(): ValueFn<any, Base['node'], string | object> {
    return ({color}) => color;
  }

  // color can be object with toString method
  get linkColor(): ValueFn<any, Base['link'], string | object> {
    return ({color}) => color;
  }

  get linkBorder() {
    return undefined;
  }

  get nodeTitle(): ValueFn<any, Base['node'], string> {    return ({description}) => description;
  }

  get linkTitle(): ValueFn<any, Base['link'], string> {
    return ({description}) => description;
  }

  get value(): (node: Base['node']) => number {
    return ({value = 0}) => value;
  }

  get circular(): ValueFn<any, Base['link'], boolean> {
    return ({circular}) => circular;
  }

  static labelEllipsis = 10;
}
