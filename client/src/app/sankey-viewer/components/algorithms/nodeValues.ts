import { representativePositiveNumber } from '../sankey/utils';

export const noneNodeValue = ({nodes}) => {
  nodes.forEach(n => {
    delete n.fixedValue;
    delete n.value;
  });
  return {
    _sets: {
      node: {
        fixedValue: false,
        value: false
      }
    }
  };
};
export const nodeValueByProperty = property => ({nodes}) => {
  nodes.forEach(n => {
    n.fixedValue = representativePositiveNumber(n[property]);
  });
  return {
    _sets: {
      node: {
        fixedValue: true
      }
    }
  };
};
